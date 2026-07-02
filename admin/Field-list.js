

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  Input,
  Button,
  Table,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
} from 'reactstrap';
import Swal from 'sweetalert2';

// HELPERS
import { get, post } from '../../helpers/api_helper';
import { GET_FIELD_LIST, MANAGE_FIELD_API, POST_NOTIFICATION } from '../../helpers/url_helper';
import usePermissions from '../../hooks/usePermissions';

const FieldManagement = () => {
  const { hasPermission, user } = usePermissions();
  const hasFieldAction = hasPermission("Field List", "Edit") || hasPermission("Field List", "Delete");
  const [activeTab, setActiveTab] = useState('1');
  const [fieldOptions, setFieldOptions] = useState({
    grades: [],
    languages: [],
    curriculums: [],
  });

  // Modal & Edit State
  const [modal, setModal] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [isEditing, setIsEditing] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const toggleModal = () => {
    setModal(!modal);
    if (modal) {
      setIsEditing(null);
      setNewValue('');
    }
  };

  const fetchAllFields = async () => {
    try {
      const response = await get(GET_FIELD_LIST);
      if (response?.items?.[0]) {
        const data = response.items[0];
        setFieldOptions({
          grades:
            typeof data.grades === 'string' ? JSON.parse(data.grades) : [],
          languages:
            typeof data.languages === 'string'
              ? JSON.parse(data.languages)
              : [],
          curriculums:
            typeof data.curriculums === 'string'
              ? JSON.parse(data.curriculums)
              : [],
        });
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  useEffect(() => {
    fetchAllFields();
  }, []);

  const getTableInfo = () => {
    if (activeTab === '1')
      return { name: 'Grade', table: 'APP_GRADES', list: fieldOptions.grades };
    if (activeTab === '2')
      return {
        name: 'Language',
        table: 'APP_LANGUAGES',
        list: fieldOptions.languages,
      };
    return {
      name: 'Curriculum',
      table: 'APP_CURRICULUM',
      list: fieldOptions.curriculums,
    };
  };

  const current = getTableInfo();

  // Pagination Logic
  const totalPages = Math.ceil(current.list.length / pageSize);
  const paginatedItems = current.list.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSave = async () => {
    if (!newValue.trim()) return;
    try {
      const payload = {
        action: isEditing ? 'UPDATE' : 'ADD',
        table: current.table,
        oldValue: isEditing,
        newValue: newValue.trim(),
      };

      const requiresApproval = !hasPermission("Approval Queue", "Approve");

      if (requiresApproval) {
        await post("admin/approval-queue", {
          moduleName: "Field List",
          actionType: isEditing ? "EDIT" : "CREATE",
          entityId: null,
          oldData: null,
          newData: payload,
          requestedBy: user?.email || user?.name || "Unknown"
        });

        Swal.fire({
          title: 'Queued for Approval!',
          text: 'Your request has been sent to the Admin for approval.',
          icon: 'info',
          confirmButtonColor: '#34c38f',
        });

        try {
          await post(POST_NOTIFICATION, {
            receiverId: "admin",
            senderId: user?.name || "admin",
            title: 'New Approval Request',
            message: `${user?.name || "A user"} submitted a request to ${isEditing ? "edit" : "create"} a Field.`,
            module: "Field List",
            actionType: "APPROVAL",
            referenceId: "",
            navigationUrl: "/approval-queue"
          });
          window.dispatchEvent(new Event('notificationAdded'));
        } catch(e) { console.error(e); }

        toggleModal();
        return;
      }

      const result = await post(MANAGE_FIELD_API, payload);

      if (result.status === 'success') {
        toggleModal();
        fetchAllFields();
        Swal.fire({
          title: 'Saved!',
          text: `${current.name} updated.`,
          icon: 'success',
          confirmButtonColor: '#2e7d45',
        });
      }
    } catch (err) {
      Swal.fire('Error', 'Action failed', 'error');
    }
  };

  const handleDelete = async (val) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Delete "${val}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e57373',
      confirmButtonText: 'Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const payload = {
            action: 'DELETE',
            table: current.table,
            oldValue: val,
            newValue: null,
          };

          const requiresApproval = !hasPermission("Approval Queue", "Approve");

          if (requiresApproval) {
            await post("admin/approval-queue", {
              moduleName: "Field List",
              actionType: "DELETE",
              entityId: null,
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
                message: `${user?.name || "A user"} submitted a request to delete a Field.`,
                module: "Field List",
                actionType: "APPROVAL",
                referenceId: "",
                navigationUrl: "/approval-queue"
              });
              window.dispatchEvent(new Event('notificationAdded'));
            } catch(e) { console.error(e); }

            return;
          }

          await post(MANAGE_FIELD_API, payload);
          fetchAllFields();
          Swal.fire('Deleted!', 'Field removed.', 'success');
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  return (
    <div className="page-content">
      <style>{`
        .table-card-body { padding: 0 !important; }

        /* Horizontal Tabs Styling */
        .tabs-header {
          display: flex;
          background: #f8faf6;
          padding: 0 26px;
          border-bottom: 1px solid #e2e8de;
        }
        .tab-btn {
          padding: 14px 20px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #8fa688;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tab-btn.active {
          color: #2e7d45;
          border-bottom-color: #2e7d45;
        }
        .tab-badge {
          background: #e2e8de;
          color: #4a5e45;
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 100px;
        }
        .tab-btn.active .tab-badge {
          background: #2e7d45;
          color: #fff;
        }

        /* Toolbar Styling */
        .table-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 20px 26px 16px;
          border-bottom: 1px solid #e2e8de;
          flex-wrap: wrap;
          gap: 12px;
        }
        .list-title {
          font-size: 16px;
          font-weight: 800;
          color: #1a2518;
          margin-bottom: 2px;
        }

        .add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          background: #64a238;
            //  background: #2e7d45;
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

        /* Table Styling */
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
        .custom-lms-table tbody tr {
          border-bottom: 1px solid #e2e8de;
          transition: background 0.14s;
        }
        .custom-lms-table tbody tr:last-child { border-bottom: none; }
        .custom-lms-table tbody tr:hover { background: #eaf5ec; }
        .custom-lms-table td {
          padding: 8px 26px;
          font-size: 13px;
          vertical-align: middle;
          border-top: none;
        }

        .td-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8fa688; }
        .td-label { font-weight: 700; color: #1a2518; }

        /* Action Buttons */
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
        .act-btn:hover { border-color: #4aab63; color: #2e7d45; background: #eaf5ec; }
        .act-btn.danger:hover { border-color: #e57373; color: #c62828; background: #fdecea; }

        /* Pagination */
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
        .lms-pagination span {
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
        <Card
          className="border-0 shadow-sm overflow-hidden"
          style={{ borderRadius: '14px' }}
        >
          <CardBody className="table-card-body">
            {/* ── Tabs ── */}
            <div className="tabs-header">
              <button
                className={`tab-btn ${activeTab === '1' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('1');
                  setCurrentPage(1);
                }}
              >
                Grades{' '}
                <span className="tab-badge">{fieldOptions.grades.length}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === '2' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('2');
                  setCurrentPage(1);
                }}
              >
                Languages{' '}
                <span className="tab-badge">
                  {fieldOptions.languages.length}
                </span>
              </button>
              <button
                className={`tab-btn ${activeTab === '3' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('3');
                  setCurrentPage(1);
                }}
              >
                Curriculums{' '}
                <span className="tab-badge">
                  {fieldOptions.curriculums.length}
                </span>
              </button>
            </div>

            {/* ── Toolbar ── */}
            <div className="table-top">
              <div>
                <h4 className="list-title">{current.name} List</h4>
                <p
                  className="mb-0"
                  style={{ fontSize: '11px', color: '#1a2518' }}
                >
                  {current.list.length} option
                  {current.list.length === 1 ? '' : 's'} configured
                </p>
              </div>
              {hasPermission("Field List", "Create") && (
                <button className="add-btn" onClick={toggleModal}>
                  <i className="mdi mdi-plus" /> Add {current.name}
                </button>
              )}
            </div>

            {/* ── Table ── */}
            <div className="table-responsive">
              <Table className="custom-lms-table table-borderless mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>ID</th>
                    <th>{current.name} Name</th>
                    {hasFieldAction && (
                      <th style={{ width: '120px' }}>
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="td-id">
                          #{(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="td-label">{item}</td>
                        {hasFieldAction && (
                          <td>
                            <div className="d-flex justify-content-start gap-2">
                              {hasPermission("Field List", "Edit") && (
                                <div
                                  className="act-btn"
                                  onClick={() => {
                                    setIsEditing(item);
                                    setNewValue(item);
                                    setModal(true);
                                  }}
                                  title="Edit"
                                >
                                  <i className="mdi mdi-pencil-outline" />
                                </div>
                              )}
                              {hasPermission("Field List", "Delete") && (
                                <div
                                  className="act-btn danger"
                                  onClick={() => handleDelete(item)}
                                  title="Delete"
                                >
                                  <i className="mdi mdi-trash-can-outline" />
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={hasFieldAction ? "3" : "2"} className="text-center py-5 text-muted">
                        No {current.name.toLowerCase()} items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>

            {/* ── Pagination ── */}
            {current.list.length > pageSize && (
              <div className="lms-pagination">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, current.list.length)} of{' '}
                  {current.list.length}
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

      {/* ── Modal ── */}
      <Modal isOpen={modal} toggle={toggleModal} centered>
        <ModalHeader toggle={toggleModal} className="border-0 pb-0">
          <span style={{ fontWeight: 800, fontSize: '16px', color: '#1a2518' }}>
            {isEditing ? `Edit ${current.name}` : `Add New ${current.name}`}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="mb-3">
            <Label
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '10px',
                textTransform: 'uppercase',
                color: '#8fa688',
              }}
            >
              {current.name} Name
            </Label>
            <Input
              type="text"
              value={newValue}
              placeholder={`Enter ${current.name.toLowerCase()} name`}
              onChange={(e) => setNewValue(e.target.value)}
              className="rounded-3 border-light"
            />
          </div>
        </ModalBody>
        <ModalFooter className="border-0 pt-0">
          <Button
            color="secondary"
            onClick={toggleModal}
            className="rounded-pill px-4"
          >
            Cancel
          </Button>
          <Button
            color="success"
            onClick={handleSave}
            className="rounded-pill px-4"
            style={{ background: '#2e7d45', border: 'none' }}
          >
            {isEditing ? 'Update' : 'Save'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default FieldManagement;
