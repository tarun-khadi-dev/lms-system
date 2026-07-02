import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Col,
  Container,
  Row,
  Label,
  Input,
  Table,
} from 'reactstrap';
import Swal from 'sweetalert2';
import Breadcrumbs from '../../components/Common/Breadcrumb';
import GlobalLoader from '../../components/Common/GlobalLoader';
import { get, del, post } from '../../helpers/api_helper';
import {
  GET_ACTIVITY_LIST,
  DELETE_ACTIVITY,
  GET_ACTIVITY_DETAIL_JSON,
  GET_FIELD_LIST,
  POST_NOTIFICATION
} from '../../helpers/url_helper';
import usePermissions from '../../hooks/usePermissions';

const InvoicesList = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = usePermissions();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [gradeFilter, setGradeFilter] = useState('All');
  const [langFilter, setLangFilter] = useState('All');
  const [currFilter, setCurrFilter] = useState('All');
  const [fieldOptions, setFieldOptions] = useState({
    grades: [],
    languages: [],
    curriculums: [],
  });

  const [globalFilter, setGlobalFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await get(GET_FIELD_LIST);
        if (response?.items?.length > 0) {
          const d = response.items[0];
          setFieldOptions({
            grades: typeof d.grades === 'string' ? JSON.parse(d.grades) : [],
            languages:
              typeof d.languages === 'string' ? JSON.parse(d.languages) : [],
            curriculums:
              typeof d.curriculums === 'string'
                ? JSON.parse(d.curriculums)
                : [],
          });
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    fetchFields();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        grade: gradeFilter,
        language: langFilter,
        curriculum: currFilter,
      }).toString();

      const rawTextResponse = await get(`${GET_ACTIVITY_LIST}?${queryParams}`, {
        transformResponse: [(data) => data],
      });

      let cleanJsonText = rawTextResponse.replace(/[\r\n\t]+/g, '');
      const parsedResponse = JSON.parse(cleanJsonText);
      const apiItems = parsedResponse.items || [];

      const processedData = apiItems.map((item) => {
        let parsedBody =
          item.data_json && typeof item.data_json === 'object'
            ? item.data_json
            : {};
        let displayPreview = 'No Content';

        if (item.activity_type === 'match') {
          displayPreview = parsedBody?.text
            ? parsedBody.text.substring(0, 50) + '...'
            : 'No Content';
        } else if (
          item.activity_type === 'sequence' ||
          item.activity_type === 'completeWord'
        ) {
          if (parsedBody?.text) {
            const firstLine = parsedBody.text.split('\n')[0] || '';
            displayPreview = firstLine.substring(0, 50) + '...';
          }
        } else if (parsedBody?.questions?.length > 0) {
          const first = parsedBody.questions[0];
          displayPreview = first?.qText || first?.question || 'MCQ Content';
        }

        return {
          ...item,
          id: item.id,
          card_id: item.card_id,
          label: item.label,
          type: item.activity_type,
          btnLabel: item.btn_label,
          title: parsedBody?.title || item.label,
          display_question: displayPreview,
          full_details: parsedBody,
          grade: item.grade || 'N/A',
          language: item.language || 'N/A',
          curriculum: item.curriculum || 'N/A',
        };
      });

      setData(processedData);
      setCurrentPage(1);
    } catch (error) {
      console.error('Fetch Error:', error);
      Swal.fire('Error', 'Failed to fetch filtered data', 'error');
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, langFilter, currFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (rowData, isReadOnly = false) => {
    setLoading(true);
    try {
      const detailResponse = await get(
        `${GET_ACTIVITY_DETAIL_JSON}/${rowData.id}`
      );
      const contentSource = detailResponse || {};
      const matchTextForForm = contentSource.text || '';
      let questionsForForm = [];

      if (rowData.type === 'mcq' && contentSource.questions) {
        questionsForForm = contentSource.questions.map((q) => {
          let rawOptionsArray = Array.isArray(q.options)
            ? q.options
            : typeof q.options === 'string'
              ? q.options.split('\n')
              : [];
          const correctIndex = rawOptionsArray.findIndex((opt) =>
            String(opt).trim().startsWith('*')
          );
          const cleanOptions = rawOptionsArray.map((opt) =>
            String(opt).replace(/\*/g, '').trim()
          );
          while (cleanOptions.length < 4) cleanOptions.push('');
          return {
            question: q.qText || q.question || '',
            answers: cleanOptions.slice(0, 4),
            correct_answer: correctIndex > -1 ? correctIndex.toString() : '0',
          };
        });
      }

      const editDataPayload = {
        ...rowData,
        data_json: detailResponse,
        data: {
          title: contentSource.title || rowData.label || '',
          text: matchTextForForm,
          questions:
            questionsForForm.length > 0
              ? questionsForForm
              : [
                {
                  question: '',
                  answers: ['', '', '', ''],
                  correct_answer: '0',
                },
              ],
        },
        readOnly: isReadOnly,
      };

      navigate('/Exercise-detail', { state: { editData: editDataPayload } });
    } catch (error) {
      console.error('Detail Fetch Error:', error);
      Swal.fire('Error', 'Could not load exercise details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2e7d45',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        const requiresApproval = !hasPermission("Approval Queue", "Approve");

        if (requiresApproval) {
          const payload = { id };
          await post("admin/approval-queue", {
            moduleName: "Exercise type",
            actionType: "DELETE",
            entityId: id,
            oldData: null,
            newData: payload,
            requestedBy: user?.email || user?.name || "Unknown"
          });

          Swal.fire({
            title: 'Queued for Approval!',
            text: 'Your delete request has been sent to the Admin for approval.',
            icon: 'info',
            confirmButtonColor: '#34c38f',
          });

          try {
            await post(POST_NOTIFICATION, {
              receiverId: "admin",
              senderId: user?.name || "admin",
              title: 'New Approval Request',
              message: `${user?.name || "A user"} submitted a request to delete an Exercise.`,
              module: "Exercise type",
              actionType: "APPROVAL",
              referenceId: String(id),
              navigationUrl: "/approval-queue"
            });
            window.dispatchEvent(new Event('notificationAdded'));
          } catch(e) { console.error(e); }

          return;
        }

        await del(`${DELETE_ACTIVITY}/${id}`);
        loadData();
      }
    });
  };

  // Filter + paginate
  const filteredData = data.filter((row) => {
    if (!globalFilter.trim()) return true;
    const q = globalFilter.toLowerCase();
    return (
      (row.label || '').toLowerCase().includes(q) ||
      (row.grade || '').toLowerCase().includes(q) ||
      (row.language || '').toLowerCase().includes(q) ||
      (row.curriculum || '').toLowerCase().includes(q) ||
      (row.type || '').toLowerCase().includes(q) ||
      String(row.id || '').includes(q)
    );
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getCurrClass = (curriculum) => {
    const c = (curriculum || '').toUpperCase().trim();
    if (['MOE', 'IGCSE', 'IB', 'CBSE'].includes(c)) return `curr-${c}`;
    return 'curr-OTHER';
  };

  const getTypeStyle = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'mcq')
      return { bg: '#dbeafe', color: '#1a5faa', border: '#bfcfe8' };
    if (t === 'match')
      return { bg: '#d0ede9', color: '#1e8a7a', border: '#a8d8d2' };
    if (t === 'sequence')
      return { bg: '#fdecd8', color: '#b45a10', border: '#e8c8a8' };
    if (t === 'completeword')
      return { bg: '#ede9fe', color: '#6b21a8', border: '#c4b5fd' };
    return { bg: '#e2e8de', color: '#4a5e45', border: '#c9d6c4' };
  };

  return (
    <div className="page-content">
      <GlobalLoader loading={loading} />

      <style>{`
        .table-card-body { padding: 0 !important; }

        .filter-bar {
          padding: 18px 26px;
          border-bottom: 1px solid #e2e8de;
          background: #f8faf6;
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          align-items: flex-end;
        }
        .filter-bar .filter-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
          min-width: 140px;
          max-width: 200px;
        }
        .filter-bar .filter-group label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1a2518;
          font-weight: 600;
          margin: 0;
        }
        .filter-bar .filter-group select {
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid #e2e8de;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #1a2518;
          background: #fff;
          outline: none;
          transition: border 0.18s;
          cursor: pointer;
        }
        .filter-bar .filter-group select:focus { border-color: #4aab63; }

        .table-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 20px 26px 16px;
          border-bottom: 1px solid #e2e8de;
          flex-wrap: wrap;
          gap: 12px;
        }
        .table-top-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .search-input-wrap { position: relative; }
        .search-input-wrap i {
          position: absolute; left: 10px; top: 50%;
          transform: translateY(-50%);
          color: #8fa688; font-size: 15px; pointer-events: none;
        }
        .search-input-wrap input {
          padding: 7px 12px 7px 32px;
          border-radius: 8px;
          border: 1px solid #e2e8de;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #1a2518;
          background: #f8faf6;
          outline: none;
          transition: border 0.18s;
          min-width: 200px;
        }
        .search-input-wrap input:focus { border-color: #4aab63; background: #fff; }

        .add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          background: #64a238;
          // background: #2e7d45;
          color: #fff !important;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.18s;
          border: none;
          box-shadow: 0 2px 8px rgba(46,125,69,0.25);
        }
        .add-btn:hover { background: #2a7d0f; }

        /* Table */
        .custom-lms-table thead th {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: #8fa688;
          text-transform: uppercase;
          text-align: left;
          padding: 11px 26px;
          background: #f8faf6;
          border-bottom: 1px solid #e2e8de;
          white-space: nowrap;
          font-weight: 500;
        }
        .custom-lms-table thead th.th-center { text-align: center; }
        .custom-lms-table tbody tr {
          border-bottom: 1px solid #e2e8de;
          transition: background 0.14s;
        }
        .custom-lms-table tbody tr:last-child { border-bottom: none; }
        .custom-lms-table tbody tr:hover { background: #eaf5ec; }
        .custom-lms-table td {
          padding: 13px 26px;
          font-size: 13px;
          vertical-align: middle;
          border-top: none;
        }
        .custom-lms-table td.td-center { text-align: center; }

        .td-id    { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8fa688; }
        .td-label { font-weight: 700; color: #1a2518; }
        .td-meta  { font-size: 12px; color: #4a5e45; font-weight: 500; }

        .curr-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 100px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 500;
        }
        .curr-MOE   { background: #d4edda; color: #2e7d45; border: 1px solid #b6dfc0; }
        .curr-IGCSE { background: #dbeafe; color: #1a5faa; border: 1px solid #bfcfe8; }
        .curr-IB    { background: #d0ede9; color: #1e8a7a; border: 1px solid #a8d8d2; }
        .curr-CBSE  { background: #fdecd8; color: #b45a10; border: 1px solid #e8c8a8; }
        .curr-OTHER { background: #e2e8de; color: #4a5e45; border: 1px solid #c9d6c4; }

        .act-btn {
          width: 30px; height: 30px;
          border-radius: 8px;
          background: #f8faf6;
          border: 1px solid #e2e8de;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 15px;
          color: #8fa688;
          transition: all 0.18s;
          text-decoration: none;
        }
        .act-btn:hover        { border-color: #4aab63; color: #2e7d45; background: #eaf5ec; }
        .act-btn.danger:hover { border-color: #e57373; color: #c62828; background: #fdecea; }

        .lms-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 26px;
          border-top: 1px solid #e2e8de;
          background: #f8faf6;
          flex-wrap: wrap;
          gap: 8px;
        }
        .lms-pagination > span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #8fa688;
        }
        .lms-pagination-btns { display: flex; gap: 4px; }
        .pg-btn {
          min-width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid #e2e8de;
          background: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #4a5e45;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 0 8px;
          transition: all 0.15s;
        }
        .pg-btn:hover:not(:disabled) { border-color: #4aab63; color: #2e7d45; background: #eaf5ec; }
        .pg-btn.active { background: #2e7d45; color: #fff; border-color: #2e7d45; }
        .pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <Container fluid>
        {/* <Breadcrumbs title="Admin" breadcrumbItem="Activity Dashboard" /> */}

        <Card
          className="border-0 shadow-sm mb-4 overflow-hidden"
          style={{ borderRadius: '14px' }}
        >
          <CardBody className="table-card-body">
            {/* ── Filter Bar ── */}
            <div className="filter-bar">
              <div className="filter-group">
                <label>Grade</label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                >
                  <option value="All">All Grades</option>
                  {fieldOptions.grades.map((g, i) => (
                    <option key={i} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Language</label>
                <select
                  value={langFilter}
                  onChange={(e) => setLangFilter(e.target.value)}
                >
                  <option value="All">All Languages</option>
                  {fieldOptions.languages.map((l, i) => (
                    <option key={i} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Curriculum</label>
                <select
                  value={currFilter}
                  onChange={(e) => setCurrFilter(e.target.value)}
                >
                  <option value="All">All Curriculums</option>
                  {fieldOptions.curriculums.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Table Header ── */}
            <div className="table-top">
              <div>
                {/* <h4
                  className="card-title mb-1"
                  style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#1a2518',
                  }}
                >
                  Activity Dashboard
                </h4> */}
                <p
                  className="mb-0"
                  style={{ fontSize: '11px', color: '#1a2518' }}
                >
                  {filteredData.length} activit
                  {filteredData.length === 1 ? 'y' : 'ies'} found
                </p>
              </div>
              <div className="table-top-right">
                <div className="search-input-wrap">
                  <i className="mdi mdi-magnify" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={globalFilter}
                    onChange={(e) => {
                      setGlobalFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                {hasPermission("Exercise type", "Create") && (
                  <button
                    className="add-btn"
                    onClick={() => navigate('/Exercise-detail')}
                  >
                    <i className="mdi mdi-plus" /> Add Activity
                  </button>
                )}
              </div>
            </div>

            {/* ── Table ── */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="custom-lms-table table-borderless mb-0">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Grade</th>
                      <th>Language</th>
                      <th>Curriculum</th>
                      <th>Type</th>
                      <th>Label</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((row) => {
                        const typeStyle = getTypeStyle(row.type);
                        return (
                          <tr key={row.id}>
                            <td className="td-id">#{row.id}</td>
                            <td className="td-meta">{row.grade}</td>
                            <td className="td-meta">{row.language}</td>
                            <td>
                              <span
                                className={`curr-badge ${getCurrClass(
                                  row.curriculum
                                )}`}
                              >
                                {(row.curriculum || 'N/A').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <span
                                className="curr-badge"
                                style={{
                                  background: typeStyle.bg,
                                  color: typeStyle.color,
                                  border: `1px solid ${typeStyle.border}`,
                                }}
                              >
                                {row.type || 'N/A'}
                              </span>
                            </td>
                            <td className="td-label">{row.label}</td>
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-start',
                                  gap: '6px',
                                }}
                              >
                                <div
                                  className="act-btn"
                                  onClick={() => handleAction(row, true)}
                                  title="View"
                                >
                                  <i className="mdi mdi-eye-outline" />
                                </div>
                                {hasPermission("Exercise type", "Edit") && (
                                  <div
                                    className="act-btn"
                                    onClick={() => handleAction(row, false)}
                                    title="Edit"
                                  >
                                    <i className="mdi mdi-pencil-outline" />
                                  </div>
                                )}
                                {hasPermission("Exercise type", "Delete") && (
                                  <div
                                    className="act-btn danger"
                                    onClick={() => handleDelete(row.id)}
                                    title="Delete"
                                  >
                                    <i className="mdi mdi-trash-can-outline" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-5 text-muted">
                          <p className="mb-0">No activities found.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}

            {/* ── Pagination ── */}
            {filteredData.length > pageSize && (
              <div className="lms-pagination">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filteredData.length)} of{' '}
                  {filteredData.length}
                </span>
                <div className="lms-pagination-btns">
                  <button
                    className="pg-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    ←
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === '...' ? (
                        <span
                          key={`e-${i}`}
                          className="pg-btn"
                          style={{ cursor: 'default' }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          className={`pg-btn${currentPage === item ? ' active' : ''
                            }`}
                          onClick={() => setCurrentPage(item)}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    className="pg-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default InvoicesList;
