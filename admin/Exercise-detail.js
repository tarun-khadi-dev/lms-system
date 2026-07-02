import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormik, FormikProvider, FieldArray } from "formik";
import * as Yup from "yup";
import {
  Card,
  CardBody,
  Col,
  Row,
  Form,
  Input,
  Label,
  Button,
  Spinner,
  FormFeedback,
} from "reactstrap";
import { GET_GRAMMAR_SUBCARDS } from "../../helpers/url_helper";
import Breadcrumbs from "../../components/Common/Breadcrumb";
import MCQSection from "./MCQSection";
import MatchBySection from "./MatchBySection";
import CompleteWordSection from "./CompleteWordSection";
import SequenceSection from "./SequenceSection";
import ClassifySentenceSection from "./ClassifySentenceSection";
import WordSearchSection from "./WordSearchSection";
import Swal from "sweetalert2";
import MatchPairSection from "./MatchPairSection";
import SelectWordSection from "./SelectWordSection";
import RightOneSection from "./RightOneSection";
import FillUpSection from "./FillUpSection";
import GroupSection from "./GroupSection";
import CompletePuzzleSection from "./CompletePuzzleSection";
import DragAndDropSection from "./DragAndDropSection";
import InformationProcessingSection from "./InformationProcessingSection";
import VisualInfoProcessingSection from "./VisualInfoProcessingSection";
import ClickAndDragSection from "./ClickAndDragSection";

import SpeakingCardsSection from "./SpeakingCardsSection";
import JumbledWordsSection from "./JumbledWordsSection";
import WordClimbSection from "./WordClimbSection";
import BalloonPopSection from "./BalloonPopSection";
import TtypeSection from "./TtypeSection";
import MemoryFlipSection from "./MemoryFlipSection";
import RocketFuelSection from "./RocketFuelSection";

import CrosswordSection from "./CrosswordSection";
import SudokuSection from "./SudokuSection";
import MathCrosswordSection from "./MathCrosswordSection";
import BalanceSection from "./BalanceSection";
import DenominationSection from "./DenominationSection";

// HELPERS
import { get, post } from "../../helpers/api_helper";
import {
  GET_CARDS_CONFIG,
  SAVE_ACTIVITY,
  GET_FIELD_LIST,
  POST_NOTIFICATION
} from "../../helpers/url_helper";
import usePermissions from "../../hooks/usePermissions";

const commonInputStyle = {
  height: "38px",
  display: "flex",
  alignItems: "center",
};

// ─── Activity type config (outside component so it's stable) ────────────────
const ACTIVITY_CATEGORIES = {
  mcq: {
    label: "MCQ",
    types: [
      { value: "mcq", label: "MCQ" },
      { value: "balloonpop", label: "Balloon Pop" },
      { value: "wordclimb", label: "Word Climb" },
      { value: "ttype", label: "Emotion Snake" },
      { value: "rocketfuel", label: "Rocket Fuel" },
      { value: "fillup", label: "Fill Up" },
      { value: "classifysentence", label: "Pick the Right Option" },
    ],
  },
  infoprocessing: {
    label: "Info Processing",
    types: [
      { value: "image", label: "Image" },
      { value: "audio", label: "Audio" },
      { value: "visual_image", label: "Image Question" },
      { value: "visual_audio", label: "Audio Question" },
      { value: "speakingcards", label: "Speaking Cards" },
    ],
  },
  sequence: {
    label: "Sequence",
    types: [
      { value: "sequence", label: "Sequence Act" },
      { value: "jumbledwords", label: "Jumbled Words / Sentence" },
    ],
  },
  dragdrop: {
    label: "Drag & Drop",
    types: [
      { value: "draganddrop", label: "Drag & Drop (Image)" },
      { value: "match", label: "Match the Pairs (Drag & Drop)" },
    ],
  },
};

const DB_ACTIVITY_TYPE_TO_CATEGORY = {
  mcq: "mcq",
  informationProcessing: "infoprocessing",
  visualInformationProcessing: "infoprocessing",
  sequence: "sequence",
  matchByDragDrop: "dragdrop",
  draganddrop: "dragdrop",
  dragAndDrop: "dragdrop",
  rocketFuel: "mcq",
  rocketfuel: "mcq",
  speakingCards: "infoprocessing",
  classifySentence: "mcq",
  classifysentence: "mcq",
  fillup: "mcq",
  variableoptions: "mcq",
  variableOptions: "mcq",
};

const getCategoryFromType = (typeValue) => {
  if (!typeValue) return "";
  const lower = typeValue.toLowerCase();
  if (lower === "memoryflip" || lower === "memory_flip") return "";
  if (ACTIVITY_CATEGORIES[typeValue]) return typeValue;
  if (DB_ACTIVITY_TYPE_TO_CATEGORY[typeValue]) return DB_ACTIVITY_TYPE_TO_CATEGORY[typeValue];
  if (DB_ACTIVITY_TYPE_TO_CATEGORY[lower]) return DB_ACTIVITY_TYPE_TO_CATEGORY[lower];
  for (const [catKey, catData] of Object.entries(ACTIVITY_CATEGORIES)) {
    if (catData.types.some((t) => t.value.toLowerCase() === lower)) return catKey;
  }
  return "";
};

const normalizeSubType = (subType) => {
  if (!subType) return "";
  const lower = subType.toLowerCase();
  for (const catData of Object.values(ACTIVITY_CATEGORIES)) {
    const match = catData.types.find((t) => t.value.toLowerCase() === lower);
    if (match) return match.value;
  }
  return lower;
};

const parseMcqQuestions = (questions) => {
  if (!Array.isArray(questions)) return [{ question: "", answers: ["", "", "", ""], correct_answer: "0" }];

  return questions.map((q) => {
    const optsString = Array.isArray(q.options)
      ? q.options.join("\n")
      : String(q.options || "");
    const rawOptions = optsString.split(/\\\\n|\\r\\n|\\n|\r\n|\n|,/).filter(Boolean);

    let rawQuestion = q.qText || q.question || "";
    let hiddenAnswer = "";
    let cleanQuestion = rawQuestion.replace(/\*(.*?)\*/g, (match, wordInside) => {
      hiddenAnswer = wordInside.trim();
      return "___";
    });

    let correctIdx = "0";
    let cleanOptions = rawOptions.map((opt, idx) => {
      let s = String(opt).trim();
      if (s.startsWith("*") && s.endsWith("*")) {
        correctIdx = idx.toString();
        return s.slice(1, -1).trim();
      }
      return s;
    });

    if (hiddenAnswer) {
      let foundIndex = cleanOptions.findIndex(opt => opt === hiddenAnswer);
      if (foundIndex > -1) {
        correctIdx = foundIndex.toString();
      } else {
        if (cleanOptions.length >= 4) {
          cleanOptions[3] = hiddenAnswer;
          correctIdx = "3";
        } else {
          cleanOptions.push(hiddenAnswer);
          correctIdx = (cleanOptions.length - 1).toString();
        }
      }
    }

    while (cleanOptions.length < 4) cleanOptions.push("");

    return {
      question: cleanQuestion,
      answers: cleanOptions.slice(0, 4),
      correct_answer: correctIdx
    };
  });
};

const mapDbDataToForm = (type, data) => {
  const values = {};
  if (!data) return values;

  values.title = data.title || "";

  switch (type) {
    case "mcq":
      values.questions = parseMcqQuestions(data.questions);
      break;

    case "balloonpop":
      values.commonOptions = data.commonOptions || [];
      values.balloonQuestions = (data.questions || []).map((q) => {
        const opts = q.options ? Array.isArray(q.options) ? q.options : q.options.split(",") : [];
        let correct = "";
        opts.forEach((opt) => {
          let s = String(opt).trim();
          if (s.endsWith("*")) {
            s = s.slice(0, -1).trim();
            correct = s;
          }
        });
        return { qText: q.qText || q.question || "", correctAnswer: correct };
      });
      break;

    case "wordclimb":
      values.wordClimbQuestions = (data.questions || []).map((q) => {
        const opts = q.options ? Array.isArray(q.options) ? q.options : q.options.split(",") : [];
        let correctIdx = 0;
        const cleanOpts = opts.map((opt, idx) => {
          let s = String(opt).trim();
          if (s.endsWith("*")) { s = s.slice(0, -1).trim(); correctIdx = idx; }
          return s;
        });
        while (cleanOpts.length < 4) cleanOpts.push("");
        return { qText: q.qText || q.question || "", options: cleanOpts.slice(0, 4), correct_answer: correctIdx.toString() };
      });
      break;

    case "ttype":
      values.ttypeQuestions = (data.questions || []).map((q) => {
        const opts = q.options || [];
        const correctVal = String(q.correct || "").trim();
        const correctIdx = opts.findIndex((opt) => String(opt).trim() === correctVal);
        const cleanOpts = opts.map((opt) => String(opt).trim());
        while (cleanOpts.length < 4) cleanOpts.push("");
        return { questionText: q.questionText || "", options: cleanOpts.slice(0, 4), correct_answer: correctIdx > -1 ? correctIdx.toString() : "0" };
      });
      break;

    case "audio":
      values.audioUrl = data.audio || "";
      values.questionsLater = data.questionsLater ?? true;
      values.audioPlayLimit = data.playLimit || "";
      values.questions = (data.questions || []).map((q) => {
        const optsString = Array.isArray(q.options) ? q.options.join("\n") : String(q.options || "");
        const rawOptions = optsString.split(/\\\\n|\\r\\n|\\n|\r\n|\n|,/).filter(Boolean);
        const cleanOptions = rawOptions.map((opt) => String(opt).trim());
        while (cleanOptions.length < 4) cleanOptions.push("");
        return { question: q.qText || q.question || "", answers: cleanOptions.slice(0, 4), correct_answer: "0" };
      });
      break;

    case "image":
      values.imageUrl = data.image || "";
      values.questions = (data.questions || []).map((q) => {
        const optsString = Array.isArray(q.options) ? q.options.join("\n") : String(q.options || "");
        const rawOptions = optsString.split(/\\\\n|\\r\\n|\\n|\r\n|\n|,/).filter(Boolean);
        const cleanOptions = rawOptions.map((opt) => String(opt).trim());
        while (cleanOptions.length < 4) cleanOptions.push("");
        return { question: q.qText || q.question || "", answers: cleanOptions.slice(0, 4), correct_answer: "0" };
      });
      break;

    case "visual_audio":
      values.audioUrl = data.audio || "";
      values.questionsLater = data.questionsLater ?? true;
      values.questions = (data.questions || []).map((q) => {
        const cleanOptions = (q.options || []).map((opt) => String(opt).trim());
        while (cleanOptions.length < 4) cleanOptions.push("");
        return { question: q.qText || q.question || "", answers: cleanOptions.slice(0, 4), correct_answer: String(q.correct_answer || "0") };
      });
      break;

    case "visual_image":
      values.imageUrl = data.image || "";
      values.questions = (data.questions || []).map((q) => {
        const cleanOptions = (q.options || []).map((opt) => String(opt).trim());
        while (cleanOptions.length < 4) cleanOptions.push("");
        return { question: q.qText || q.question || "", answers: cleanOptions.slice(0, 4), correct_answer: String(q.correct_answer || "0") };
      });
      break;

    case "speakingcards":
      values.cards = (data.cards || []).map((c) => ({ text: c.text || "", audio: c.audio || "", image: c.image || "", audioPreview: c.audio || "", imagePreview: c.image || "" }));
      break;

    case "memoryflip":
      values.cardBackImage = data.cardBackImage || "";
      values.memoryQuestions = (data.questions || []).map((q) => ({ qText: q.qText || q.question || "", answer: q.answer || "", image: q.image || "" }));
      break;

    case "sequence":
      const subtype = data.text?.includes("\n\n") ? "sentence" : "character";
      const seqSeparator = data.text?.includes("\n\n") ? "\n\n" : "\n";
      values.sequenceSubtype = subtype;
      values.sequenceItems = (data.text || "").split(seqSeparator).filter(Boolean).map((text) => ({ text: text.trim() }));
      break;

    case "jumbledwords":
      values.jumbledQuestions = (data.questions || []).map((q) => ({ text: q.text || "" }));
      break;

    case "draganddrop":
      if (data.dragDropItems && Array.isArray(data.dragDropItems) && data.dragDropItems.length > 0) {
        values.dragDropItems = data.dragDropItems;
      } else if (data.words && Array.isArray(data.words) && data.words.length > 0) {
        const pathsArr = data.svg?.paths || [];
        values.dragDropItems = data.words.map((w, idx) => ({ word: w.word || "", src: pathsArr[idx]?.src || "" }));
      } else if (data.text && typeof data.text === "string") {
        values.dragDropItems = data.text.split("\n").filter(Boolean).map(line => {
          const parts = line.split("|");
          return { src: parts[0] ? parts[0].trim() : "", word: parts[1] ? parts[1].trim() : "" };
        });
      } else {
        values.dragDropItems = [{ src: "", word: "" }];
      }
      break;

    case "match":
      const lines = (data.text || "").split("\n").filter(Boolean);
      values.questions = lines.map((line) => {
        const starMatch = line.match(/(.*?)\*(.*?)\*(.*)/);
        if (starMatch) {
          return { text: `${starMatch[1]} ___ ${starMatch[3]}`.trim(), answer: starMatch[2].trim() };
        }
        if (line.includes(",")) {
          const parts = line.split(",");
          return { text: parts[0].trim(), answer: parts[1] ? parts[1].trim() : "" };
        }
        return { text: line, answer: "" };
      });
      break;

    case "rocketfuel":
      values.rocketExtraOptions = data.extraOptions || "";
      values.rocketQuestions = (data.questions || []).map((q) => {
        const ans = q.answers || [];
        while (ans.length < 4) ans.push("");
        return { qText: q.qText || q.question || "", answers: ans.slice(0, 4) };
      });
      break;

    case "completeword":
      values.completeWords = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const parts = line.split("|");
        const correct = parts[1] || "";
        const question = parts[2] || "";
        const options = parts[3] ? parts[3].split(",") : ["", ""];
        while (options.length < 2) options.push("");
        return { question: question, correct: correct, options: options.slice(0, 2) };
      });
      break;

    case "classifysentence":
      values.questions = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const parts = line.split("|");
        const word = parts[0] ? parts[0].trim() : "";
        const sentence = parts[1] ? parts[1].trim() : "";
        const rawOpts = parts[2] ? parts[2].split(",") : [];

        let correctIdx = 0;
        const cleanOpts = rawOpts.map((opt, idx) => {
          const s = opt.trim();
          if (s.startsWith("*")) { correctIdx = idx; return s.slice(1).trim(); }
          return s;
        });
        while (cleanOpts.length < 2) cleanOpts.push("");
        return { word: word, sentence: sentence, options: cleanOpts.slice(0, 2), correct_answer: correctIdx.toString() };
      });
      break;

    case "wordsearch":
      let rawWords = [];
      if (typeof data.words === "string") {
        try { rawWords = JSON.parse(data.words); } catch (e) { rawWords = data.words.split(/\\n|\n|,/).filter(Boolean); }
      } else if (Array.isArray(data.words)) {
        rawWords = data.words;
      }
      let parsedWords = rawWords.map((w) => {
        if (typeof w === "string") return w;
        if (w && typeof w === "object") { return w.word || w.text || w.value || Object.values(w)[0] || ""; }
        return String(w);
      });
      let parsedTable = [];
      if (typeof data.table === "string") {
        try { parsedTable = JSON.parse(data.table); } catch (e) { }
      } else if (Array.isArray(data.table)) {
        parsedTable = data.table;
      }
      parsedTable = parsedTable.map(row => {
        if (typeof row === "string") { return row.split(""); }
        return Array.isArray(row) ? row : [];
      });
      values.generatedWords = parsedWords;
      values.generatedTable = parsedTable;
      values.wordList = parsedWords.length > 0 ? parsedWords : [""];
      break;

    case "matchpair":
      values.matchPairs = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const idx = line.lastIndexOf(",");
        if (idx > -1) { return { left: line.substring(0, idx).trim(), right: line.substring(idx + 1).trim() }; }
        return { left: line.trim(), right: "" };
      });
      break;

    case "selectword":
      values.selectWordQuestions = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const match = line.match(/\*(.*?)\*/);
        return { sentence: line.replace(/\*/g, "").trim(), answer: match ? match[1].trim() : "" };
      });
      break;

    case "rightone":
      values.rightOnePairs = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const idx = line.indexOf(",");
        if (idx > -1) { return { correct: line.substring(0, idx).trim(), wrong: line.substring(idx + 1).trim() }; }
        return { correct: line.trim(), wrong: "" };
      });
      break;

    case "fillup":
      const fillUpLines = (data.text || "").split(/\\\\n|\\r\\n|\\n|\r\n|\n/).filter(Boolean);
      values.fillUpQuestions = fillUpLines.map((line) => {
        const match = line.match(/\*(.*?)\s*\((.*?)\)\*/);
        if (match) {
          const right = match[1].trim();
          const wrong = match[2].trim();
          const sentence = line.replace(/\*(.*?)\s*\((.*?)\)\*/, "___").trim();
          return { sentence, right, wrong };
        }
        return { sentence: line.trim(), right: "", wrong: "" };
      });
      break;

    case "group":
      values.groupData = (data.types || []).map((g) => ({ name: g.name || "", text: g.text || "" }));
      break;

    case "completepuzzle":
      values.puzzlePairs = (data.text || "").split("\n").filter(Boolean).map((line) => {
        const parts = line.split(",");
        return { base: parts[0] ? parts[0].trim() : "", right: parts[1] ? parts[1].trim() : "", wrong: parts[2] ? parts[2].trim() : "" };
      });
      break;

    case "clickanddrag":
      values.clickAndDragRows = (data.rows || []).map((r) => ({
        word: r.word || "", audioSrc: r.audioSrc || "", example1: r.examples?.[0]?.src || "", example2: r.examples?.[1]?.src || "", correctImg: r.correctAnswer?.src || "", distractor1: r.distractors?.[0]?.src || "", distractor2: r.distractors?.[1]?.src || ""
      }));
      break;

    case "sudoku":
      values.sudokuGridType = (data.commonData?.type || "").startsWith("4x4") ? "4x4" : "9x9";
      values.sudokuContentType = (data.commonData?.type || "").endsWith("words") ? "words" : "numbers";
      values.sudokuPuzzles = (data.data || []).map((text) => ({ text: text || "" }));
      break;

    case "mathcrossword":
      values.mathCrosswordPuzzles = (data.data || []).map((p) => ({ text: p.text || "", answer: Array.isArray(p.answer) ? p.answer.join(",") : p.answer || "" }));
      break;

    case "balance":
      values.balancePuzzles = (data.data || []).map((p) => ({ left: p.left || "", right: p.right || "", options: Array.isArray(p.options) ? p.options.join(",") : p.options || "" }));
      break;

    case "denomination":
      values.denominationData = {
        currencySymbol: data.currencySymbol || "₹",
        questions: (data.questions || []).map((q) => ({ targetAmount: q.targetAmount || "", denominations: (q.denominations || []).map((d) => ({ value: d.value || "", imageUrl: d.imageUrl || "" })) })),
      };
      break;

    case "crossword":
      values.crosswordRows = data.rows || 12;
      values.crosswordCols = data.cols || 12;
      values.crosswordWords = (data.words || []).map((w) => ({ number: w.number || "", clue: w.clue || "", answer: w.answer || "", row: w.row || 0, col: w.col || 0, direction: w.direction || "across" }));
      break;

    default:
      break;
  }

  return values;
};


function InvoicesDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = usePermissions();

  const editData = location.state?.editData || null;
  const isEdit = !!editData;
  const isViewOnly = editData?.readOnly || false;

  const [cards, setCards] = useState([]);
  const [grammarSubcards, setGrammarSubcards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  // Initialize activityCategory from activity_type (DB parent key) first,
  // falling back to sub_activity_type if needed.
  const [activityCategory, setActivityCategory] = useState(() =>
    getCategoryFromType(
      editData?.activity_type ||
      editData?.sub_activity_type ||
      ""
    )
  );

  const validationSchema = Yup.object().shape({
    grade: Yup.string().required("Grade is required"),
    language: Yup.string().required("Language is required"),
    curriculum: Yup.string().required("Curriculum is required"),
    topic_name: Yup.string(),
    card_id: Yup.string().required("Please select a Card/Topic"),
    type: Yup.string().required("Activity Type is required"),
    label: Yup.string().required("Activity Label is required"),
    title: Yup.string().required("Instruction Title is required"),
  });

  const [fieldOptions, setFieldOptions] = useState({
    grades: [],
    languages: [],
    curriculums: [],
  });

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await get(GET_FIELD_LIST);

        if (response && response.items && response.items.length > 0) {
          const data = response.items[0];

          setFieldOptions({
            grades:
              typeof data.grades === "string"
                ? JSON.parse(data.grades)
                : Array.isArray(data.grades)
                  ? data.grades
                  : [],

            languages:
              typeof data.languages === "string"
                ? JSON.parse(data.languages)
                : Array.isArray(data.languages)
                  ? data.languages
                  : [],

            curriculums:
              typeof data.curriculums === "string"
                ? JSON.parse(data.curriculums)
                : Array.isArray(data.curriculums)
                  ? data.curriculums
                  : [],
          });
        }
      } catch (err) {
        console.error("Error fetching dynamic fields:", err);
      }
    };
    fetchFields();
  }, []);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const json = await get(`${GET_CARDS_CONFIG}?mode=admin`);
        let cardList = [];
        if (json.items && json.items.length > 0) {
          const rawList = json.items[0].list;
          cardList =
            typeof rawList === "string" ? JSON.parse(rawList) : rawList || [];
        }
        setCards(cardList);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoadingCards(false);
      }
    };
    fetchCards();
  }, []);

  useEffect(() => {
    const fetchGrammarSubcards = async () => {
      try {
        const response = await get(
          `${GET_GRAMMAR_SUBCARDS}?card_id=18`
        );
        setGrammarSubcards(response.items || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchGrammarSubcards();
  }, []);

  const validation = useFormik({
    enableReinitialize: true,
    validationSchema: validationSchema,
    initialValues: {
      grade: editData?.grade || "",
      language: editData?.language || "",
      curriculum: editData?.curriculum || "",
      topic_name: editData?.topic_name || "",
      id: editData?.id || null,
      card_id: editData?.card_id || "",
      grammar_subcard: editData?.grammar_subcard_id || "",
      label: editData?.label || "",
      // "type" drives which section renders and which switch-case runs.
      // Prefer sub_activity_type (normalized to match ACTIVITY_CATEGORIES values),
      // fall back to activity_type.
      type: normalizeSubType(editData?.sub_activity_type) || editData?.activity_type || "",
      // activity_category stores the parent DB type (e.g. "mcq", "informationProcessing")
      activity_category: editData?.activity_type || "",
      // sub_activity_type stores the normalized subtype
      sub_activity_type: normalizeSubType(editData?.sub_activity_type) || "",
      btn_label: editData?.btn_label || "Fill Up by Drag",
      title: "",
      title_local: "",
      lang: "hi",
      options: [],

      clickAndDragRows: [
        {
          word: "",
          audioSrc: "",
          example1: "",
          example2: "",
          correctImg: "",
          distractor1: "",
          distractor2: "",
        },
      ],

      denominationData: {
        currencySymbol: "₹",
        questions: [
          {
            targetAmount: "",
            denominations: [{ value: "", imageUrl: "" }],
          },
        ],
      },

      questions: [
        {
          question: "",
          answers: ["", "", "", ""],
          correct_answer: "0",
          text: "",
          answer: "",
          word: "",
          options: ["", ""],
        },
      ],

      audioUrl: editData?.audio || "",
      imageUrl: editData?.image || "",
      questionsLater: editData?.questionsLater ?? true,
      audioPlayLimit: "",

      wordList: [""],
      generatedTable: [],
      generatedWords: [],
      rows: 8,
      cols: 8,
      completeWords: [{ question: "", correct: "", options: ["", ""] }],
      sequenceSubtype: "character",
      sequenceItems: [{ text: "" }],
      matchPairs: [{ left: "", right: "" }],
      selectWordQuestions: [{ sentence: "", answer: "" }],
      rightOnePairs: [{ correct: "", wrong: "" }],
      fillUpQuestions: [{ sentence: "", right: "", wrong: "" }],
      groupData: [{ name: "", text: "" }],
      puzzlePairs: [{ base: "", right: "", wrong: "" }],
      dragDropItems: [{ src: "", word: "" }],
      crosswordRows: 12,
      crosswordCols: 12,
      crosswordWords: [
        {
          number: 1,
          clue: "",
          answer: "",
          row: 0,
          col: 0,
          direction: "across",
        },
      ],

      cards: [
        {
          text: "",
          audio: "",
          image: "",
          audioPreview: "",
          imagePreview: "",
        },
      ],
      jumbledQuestions: [
        {
          text: "",
        },
      ],
      wordClimbQuestions: [
        {
          qText: "",
          options: ["", "", "", ""],
          correct_answer: "0",
        },
      ],
      commonOptions: [],
      BalloonImage: "",
      balloonQuestions: [
        {
          qText: "",
          correctAnswer: "",
        },
      ],
      cardBackImage: "",
      ttypeQuestions: [
        {
          questionText: "",
          options: ["", "", "", ""],
          correct_answer: "0",
        },
      ],
      memoryQuestions: [
        {
          qText: "",
          answer: "",
          image: "",
        },
      ],

      rocketQuestions: [
        {
          qText: "",
          answers: ["", "", "", ""],
        },
      ],

      rocketExtraOptions: "",

      sudokuGridType: "9x9",
      sudokuContentType: "numbers",
      sudokuPuzzles: [{ text: "" }],
      mathCrosswordPuzzles: [{ text: "", answer: "" }],
      balancePuzzles: [{ left: "1,1,?", right: "8", options: "7,6,8,9" }],
    },

    onSubmit: async (values) => {
      if (isViewOnly) return;

      const type = values.type?.trim().toLowerCase();
      let apiPayload = null;

      const basePayload = {
        activity_id: isEdit ? values.id : null,
        card_id: Number(values.card_id),
        grammar_subcard_id:
          values.card_id == 18
            ? Number(values.grammar_subcard)
            : null,
        label: values.label,
        grade: values.grade,
        language: values.language,
        curriculum: values.curriculum,
        topic_name: values.topic_name,
        // Always send sub_activity_type when a category group is active.
        // Each case below overrides type to the DB parent value; sub_activity_type
        // keeps the specific variant. Cases that already set their own
        // sub_activity_type (balloonpop, wordclimb, etc.) will override this.
        sub_activity_type: activityCategory ? values.type : null,
      };

      try {
        switch (type) {
          case "match": {
            const formattedText = values.questions
              .filter((q) => q.text.trim() !== "" && q.answer.trim() !== "")
              .map((q) => {
                const sentence = q.text.trim();
                const answer = q.answer.trim();
                if (sentence.includes("___")) {
                  return sentence.replace("___", `*${answer}*`);
                }
                return `${sentence} *${answer}*`;
              })
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please fill in at least one sentence and answer for the Match activity.",
                "error",
              );
              return;
            }

            const data_json = {
              dashWidth: 70,
              bgData: {
                imgWidth: 928,
                top: 20,
                left: 300,
                width: 600,
                bgImg: "konzeptes/comprehension.jpg",
                imgHeight: 700,
                height: 650,
              },
              fontSize: "1rem",
              text: formattedText,
              title: values.title,
              title_local: values.title_local,
            };

            apiPayload = {
              activity_id: isEdit ? editData.id : "",
              card_id: values.card_id,
              label: values.label,
              grade: values.grade,
              language: values.language,
              curriculum: values.curriculum,
              topic_name: values.topic_name,
              grammar_subcard_id: values.card_id == 18 ? Number(values.grammar_subcard) : null,
              sub_activity_type: activityCategory ? values.type : null,
              type: "matchByDragDrop",
              btn_label: "Fill Up by Drag",
              data_json: JSON.stringify(data_json),
            };
            break;
          }

          case "audio": {
            if (!values.audioUrl?.trim()) {
              Swal.fire(
                "Validation Error",
                "Please provide a valid Audio URL.",
                "error",
              );
              return;
            }
            const activeQuestions = values.questions.filter(
              (q) => q.question.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure at least one question.",
                "error",
              );
              return;
            }

            const dataJsonObj = {
              title: values.title,
              title_local: values.title_local,
              type: "audio",
              audio: values.audioUrl,
              questionsLater: values.questionsLater,
              playLimit: values.audioPlayLimit
                ? Number(values.audioPlayLimit)
                : null,
              questions: activeQuestions.map((q) => {
                return {
                  qText: q.question.trim(),
                  options: q.answers.map((ans) => ans.trim()).join("\n"),
                };
              }),
            };

            apiPayload = {
              ...basePayload,
              type: "informationProcessing",
              sub_activity_type: "audio",
              btn_label: "Listen & Answer",
              data_json: JSON.stringify(dataJsonObj),
            };
            break;
          }

          case "image": {
            if (!values.imageUrl?.trim()) {
              Swal.fire(
                "Validation Error",
                "Please provide a valid Image URL.",
                "error",
              );
              return;
            }
            const activeQuestions = values.questions.filter(
              (q) => q.question.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure at least one question.",
                "error",
              );
              return;
            }

            const dataJsonObj = {
              title: values.title,
              title_local: values.title_local,
              type: "image",
              image: values.imageUrl,
              bgData: {
                imgWidth: 928,
                top: 20,
                left: 300,
                width: 600,
                bgImg: "konzeptes/comprehension.jpg",
                imgHeight: 700,
                height: 650,
              },
              questions: activeQuestions.map((q) => {
                return {
                  type: "mcq",
                  qText: q.question.trim(),
                  options: q.answers.map((ans) => ans.trim()).join(","),
                };
              }),
            };

            apiPayload = {
              ...basePayload,
              type: "informationProcessing",
              sub_activity_type: "image",
              btn_label: "Look & Answer",
              data_json: JSON.stringify(dataJsonObj),
            };
            break;
          }

          case "visual_audio": {
            if (!values.audioUrl?.trim()) {
              Swal.fire(
                "Validation Error",
                "Please provide a valid Audio URL.",
                "error",
              );
              return;
            }
            const activeQuestions = values.questions.filter(
              (q) => q.question.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure at least one question.",
                "error",
              );
              return;
            }

            const dataJsonObj = {
              title: values.title,
              title_local: values.title_local,
              type: "visual_audio",
              audio: values.audioUrl,
              questionsLater: values.questionsLater,
              questions: activeQuestions.map((q) => {
                return {
                  qText: q.question.trim(),
                  options: q.answers,
                  correct_answer: q.correct_answer || "0",
                };
              }),
            };

            apiPayload = {
              ...basePayload,
              type: "visualInformationProcessing",
              sub_activity_type: "visual_audio",
              btn_label: "Listen & Choose",
              data_json: JSON.stringify(dataJsonObj),
            };
            break;
          }

          case "visual_image": {
            if (!values.imageUrl?.trim()) {
              Swal.fire(
                "Validation Error",
                "Please provide a valid Image URL.",
                "error",
              );
              return;
            }
            const activeQuestions = values.questions.filter(
              (q) => q.question.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure at least one question.",
                "error",
              );
              return;
            }

            const dataJsonObj = {
              title: values.title,
              title_local: values.title_local,
              type: "visual_image",
              image: values.imageUrl,
              questions: activeQuestions.map((q) => {
                return {
                  qText: q.question.trim(),
                  options: q.answers,
                  correct_answer: q.correct_answer || "0",
                };
              }),
            };

            apiPayload = {
              ...basePayload,
              type: "visualInformationProcessing",
              sub_activity_type: "visual_image",
              btn_label: "Look & Choose",
              data_json: JSON.stringify(dataJsonObj),
            };
            break;
          }

          case "mcq": {
            const activeQuestions = values.questions.filter(
              (q) => q.question.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please add at least one complete MCQ question configuration.",
                "error",
              );
              return;
            }

            const dataJsonObj = {
              title: values.title,
              title_local: values.title_local,
              questions: activeQuestions.map((q) => {
                const correctIdx = parseInt(q.correct_answer);
                const formattedOptions = q.answers.map((ans, idx) =>
                  idx === correctIdx ? `*${ans.trim()}*` : ans.trim(),
                );
                return {
                  qText: q.question,
                  options: formattedOptions.join("\n"),
                };
              }),
            };

            apiPayload = {
              ...basePayload,
              type: "mcq",
              sub_activity_type: "mcq",
              btn_label: "MCQ",
              data_json: JSON.stringify(dataJsonObj),
            };
            break;
          }

          case "completeword": {
            const formattedText = values.completeWords
              .filter(
                (q) => q.question.trim() !== "" && q.correct.trim() !== "",
              )
              .map((q) => {
                const question = q.question.trim();
                const correct = q.correct.trim();
                const options = q.options
                  .filter((opt) => opt.trim() !== "")
                  .join(",");
                const fullWord = question.replace("_", correct);
                return `${fullWord}|${correct}|${question}|${options}`;
              })
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please map out at least one dynamic structural template word config.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "completeWord",
              btn_label: "Find the Word",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                lang: values.lang || "hi",
                text: formattedText,
                images: "stockImgs",
              }),
            };
            break;
          }

          case "sequence": {
            const formattedText = values.sequenceItems
              .filter((item) => item.text.trim() !== "")
              .map((item) => {
                if (values.sequenceSubtype === "character") {
                  const charClusterRegex = /[\u0900-\u097F][\u093E-\u094D]*/g;
                  const clusters =
                    item.text.trim().match(charClusterRegex) || [];
                  return clusters.join(" ");
                }
                return item.text.trim();
              })
              .join(values.sequenceSubtype === "character" ? "\n" : "\n\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please populate text configurations to order sequentially.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "sequence",
              sub_activity_type: "sequence",
              btn_label: "Jumbled",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                lang: values.lang || "hi",
                text: formattedText,
              }),
            };
            break;
          }

          case "classifysentence": {
            const cleanQuestions = values.questions.filter(
              (q) => q.word.trim() !== "",
            );
            if (cleanQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please provide at least one classification structure item entry.",
                "error",
              );
              return;
            }

            const textData = cleanQuestions
              .map((q) => {
                const opts = q.options.map((opt, idx) =>
                  idx.toString() === q.correct_answer
                    ? `*${opt.trim()}`
                    : opt.trim(),
                );
                return `${q.word} | ${q.word} | ${opts.join(",")}`;
              })
              .join("\n");

            apiPayload = {
              ...basePayload,
              type: "classifySentence",
              btn_label: "Pick the Right Option",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: textData,
              }),
            };
            break;
          }

          case "wordsearch": {
            if (
              !values.generatedWords ||
              values.generatedWords.length === 0 ||
              !values.generatedTable ||
              values.generatedTable.length === 0
            ) {
              Swal.fire(
                "Validation Error",
                "Please input target vocab elements and select 'Generate Grid' before proceeding.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "wordsearch",
              btn_label: "Word Search",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                words: values.generatedWords,
                table: values.generatedTable,
                lang: "en",
                showWords: true,
              }),
            };
            break;
          }

          case "matchpair": {
            const formattedText = values.matchPairs
              .filter((p) => p.left.trim() !== "" && p.right.trim() !== "")
              .map((p) => `${p.left.trim()}, ${p.right.trim()}`)
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please specify matching node linkages (Left & Right pairings) completely.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "match",
              btn_label: "Match",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: formattedText,
              }),
            };
            break;
          }

          case "selectword": {
            const formattedText = values.selectWordQuestions
              .filter((q) => q.sentence.trim() !== "" && q.answer.trim() !== "")
              .map((q) => {
                const sentence = q.sentence.trim();
                const answer = q.answer.trim();
                return sentence.includes(answer)
                  ? sentence.replace(answer, `*${answer}*`)
                  : sentence;
              })
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please insert at least one contextual statement highlighting its focal element selection.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "selectWord",
              btn_label: "Select Word",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: formattedText,
              }),
            };
            break;
          }

          case "rightone": {
            const formattedText = values.rightOnePairs
              .filter((p) => p.correct.trim() !== "" && p.wrong.trim() !== "")
              .map((p) => `${p.correct.trim()},${p.wrong.trim()}`)
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please construct right vs wrong lexical items binary choice models.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "rightOne",
              btn_label: "Right Option",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: formattedText,
              }),
            };
            break;
          }

          case "fillup": {
            const formattedText = values.fillUpQuestions
              .filter((q) => q.sentence.trim() !== "" && q.right.trim() !== "")
              .map((q) => {
                const { sentence, right, wrong } = q;
                const placeholder = `*${right.trim()} (${wrong.trim()})*`;
                if (sentence.includes("___"))
                  return sentence.replace("___", placeholder);
                return sentence + " " + placeholder;
              })
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please specify cloze passage expressions alongside dynamic option structures.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "fillup",
              btn_label: "Fill Up",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: formattedText,
                type: "variableOptions",
                lang: "hi",
              }),
            };
            break;
          }

          case "group": {
            const validGroups = values.groupData.filter(
              (g) => g.name.trim() !== "" && g.text.trim() !== "",
            );
            if (validGroups.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please categorize sorting structural arrays with group labels accurately.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "group",
              btn_label: "Group",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                types: validGroups.map((g) => ({
                  name: g.name.trim(),
                  text: g.text.trim(),
                })),
              }),
            };
            break;
          }

          case "completepuzzle": {
            const formattedText = values.puzzlePairs
              .filter((p) => p.base.trim() !== "" && p.right.trim() !== "")
              .map(
                (p) => `${p.base.trim()}, ${p.right.trim()}, ${p.wrong.trim()}`,
              )
              .join("\n");

            if (!formattedText || formattedText.trim() === "") {
              Swal.fire(
                "Validation Error",
                "Please append missing constituent parts tracking puzzle items correctly.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "completePuzzle",
              btn_label: "Join the Words",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                text: formattedText,
                leftWidth: 150,
                rightWidth: 150,
                type: "rightOpen",
                printTitle: "Underline the right option.",
              }),
            };
            break;
          }

          case "draganddrop": {
            const items = values.dragDropItems.filter((i) => i.src && i.word);
            if (items.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please submit complete graphics references bound to a keyword matching map.",
                "error",
              );
              return;
            }

            const words = items.map((item, idx) => ({
              x: 240,
              y: 40 + idx * 90,
              word: item.word.trim(),
            }));
            const paths = items.map((item, idx) => ({
              rotate: 0,
              src: item.src,
              x: 20,
              y: 20 + idx * 90,
              width: 70,
              height: 70,
              maintainAR: true,
              type: "image",
              fill: "none",
              stroke: "#0d3756",
            }));

            apiPayload = {
              ...basePayload,
              type: "dragAndDrop",
              sub_activity_type: "draganddrop",
              btn_label: "Match",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                width: 400,
                height: 50 + items.length * 90,
                wordWidth: 60,
                words: words,
                svg: {
                  paths: paths,
                  props: { fill: "none", strokeWidth: 1, stroke: "black" },
                },
              }),
            };
            break;
          }

          case "clickanddrag": {
            const formattedRows = values.clickAndDragRows
              .filter(
                (r) =>
                  r.word.trim() !== "" ||
                  r.correctImg !== "" ||
                  r.audioSrc !== "",
              )
              .map((r, idx) => ({
                id: `row${idx}`,
                word: r.word,
                audioSrc: r.audioSrc,
                examples: [
                  { src: r.example1, alt: "Example 1" },
                  { src: r.example2, alt: "Example 2" },
                ],
                correctAnswer: { src: r.correctImg, id: `ans_${idx}` },
                distractors: [
                  { src: r.distractor1, id: `dist_${idx}_1` },
                  { src: r.distractor2, id: `dist_${idx}_2` },
                ],
              }));

            if (formattedRows.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please structure vocabulary matrix metrics definitions fully.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "clickAndDrag",
              btn_label: "Vocabulary",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                rows: formattedRows,
              }),
            };
            break;
          }

          case "speakingcards": {
            const filteredCards = values.cards
              .filter((card) => card.text?.trim() || card.image || card.audio)
              .map((card) => ({
                text: card.text?.trim() || "",
                audio: card.audio || "",
                image: card.image || "",
              }));

            if (filteredCards.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure interactive speaking cards with textual content maps.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "speakingCards",
              sub_activity_type: "speakingcards",
              btn_label: "Speaking Cards",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                cards: filteredCards,
              }),
            };
            break;
          }

          case "jumbledwords": {
            const filteredQuestions = values.jumbledQuestions.filter((q) =>
              q.text?.trim(),
            );
            if (filteredQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please append mixed syntactic array configuration statements.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "sequence",
              sub_activity_type: "jumbledWords",
              btn_label: "Jumbled Words",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                questions: filteredQuestions,
              }),
            };
            break;
          }

          case "wordclimb": {
            const activeQuestions = values.wordClimbQuestions.filter(
              (q) => q.qText.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please provision stair step incremental word challenges items.",
                "error",
              );
              return;
            }

            const formattedQuestions = activeQuestions.map((q) => {
              const correctIdx = parseInt(q.correct_answer);
              const formattedOptions = q.options.map((opt, idx) =>
                idx === correctIdx ? `${opt.trim()}*` : opt.trim(),
              );
              return {
                qText: q.qText,
                options: formattedOptions.join(","),
              };
            });

            apiPayload = {
              ...basePayload,
              type: "mcq",
              sub_activity_type: "wordClimb",
              btn_label: "Word Climb",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                instruction: "",
                questions: formattedQuestions,
              }),
            };
            break;
          }

          case "balloonpop": {
            const cleanOptions = values.commonOptions.filter(
              (opt) => opt.trim() !== "",
            );
            if (cleanOptions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please configure balloon shared variable selection pools.",
                "error",
              );
              return;
            }
            const activeQuestions = values.balloonQuestions.filter(
              (q) => q.qText.trim() !== "",
            );
            if (activeQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please attach localized challenge vectors to target pops.",
                "error",
              );
              return;
            }

            const formattedQuestions = activeQuestions.map((q) => {
              const formattedOptions = values.commonOptions.map((opt) =>
                opt === q.correctAnswer ? `${opt.trim()}*` : opt.trim(),
              );
              return {
                qText: q.qText,
                options: formattedOptions.join(","),
              };
            });

            apiPayload = {
              ...basePayload,
              type: "mcq",
              sub_activity_type: "balloonPop",
              btn_label: "Balloon Pop",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                commonOptions: values.commonOptions,
                questions: formattedQuestions,
              }),
            };
            break;
          }

          case "ttype": {
            const cleanInputs = values.ttypeQuestions.filter(
              (q) => q.questionText.trim() !== "",
            );
            if (cleanInputs.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please provide level contexts for arcade sequence engine.",
                "error",
              );
              return;
            }

            const formattedQuestions = cleanInputs.map((q) => {
              const correctIdx = parseInt(q.correct_answer);
              const cleanOptions = q.options
                .map((opt) => opt.trim())
                .filter((opt) => opt !== "");
              return {
                questionText: q.questionText.trim(),
                correct: cleanOptions[correctIdx] || cleanOptions[0],
                options: cleanOptions,
              };
            });

            apiPayload = {
              ...basePayload,
              type: "mcq",
              sub_activity_type: "ttype",
              btn_label: "Emotion Snake",
              data_json: JSON.stringify({
                questions: formattedQuestions,
              }),
            };
            break;
          }

          case "memoryflip": {
            if (!values.memoryQuestions || values.memoryQuestions.length < 6) {
              Swal.fire(
                "Validation Error",
                "Please add at least 6 cards.",
                "error",
              );
              return;
            }

            if (!values.cardBackImage?.trim()) {
              Swal.fire(
                "Validation Error",
                "Please upload a Card Back Image.",
                "error",
              );
              return;
            }

            for (let i = 0; i < values.memoryQuestions.length; i++) {
              const q = values.memoryQuestions[i];
              if (!q.qText?.trim() || !q.answer?.trim() || !q.image?.trim()) {
                Swal.fire(
                  "Validation Error",
                  `Card ${i + 1} parameters must be populated fully.`,
                  "error",
                );
                return;
              }
            }

            const filteredQuestions = values.memoryQuestions.map((q) => ({
              qText: q.qText.trim(),
              answer: q.answer.trim(),
              image: q.image.trim(),
            }));

            apiPayload = {
              ...basePayload,
              type: "informationProcessing",
              sub_activity_type: "memoryFlip",
              btn_label: "Memory Flip",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                instruction: "सही चित्र पर क्लिक करें",
                cardBackImage: values.cardBackImage,
                questions: filteredQuestions,
              }),
            };
            break;
          }

          case "rocketfuel": {
            if (
              !values.rocketQuestions ||
              values.rocketQuestions.length === 0
            ) {
              Swal.fire(
                "Validation Error",
                "Please add at least one question.",
                "error",
              );
              return;
            }

            const extraOptions = values.rocketExtraOptions
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean);

            if (extraOptions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please enter common extra options.",
                "error",
              );
              return;
            }

            for (let i = 0; i < values.rocketQuestions.length; i++) {
              const q = values.rocketQuestions[i];

              if (!q.qText?.trim()) {
                Swal.fire(
                  "Validation Error",
                  `Question ${i + 1} is required.`,
                  "error",
                );
                return;
              }

              const validAnswers = q.answers.filter((a) => a?.trim());

              if (validAnswers.length < 4) {
                Swal.fire(
                  "Validation Error",
                  `Question ${i + 1} must contain 4 answers.`,
                  "error",
                );
                return;
              }
            }

            const formattedQuestions = values.rocketQuestions.map((q) => ({
              qText: q.qText,
              answers: q.answers,
            }));

            apiPayload = {
              ...basePayload,
              type: "rocketFuel",
              sub_activity_type: "rocketfuel",
              btn_label: "Rocket Fuel",
              data_json: JSON.stringify({
                title: values.title,
              title_local: values.title_local,
                questions: formattedQuestions,
                extraOptions: values.rocketExtraOptions,
              }),
            };

            break;
          }

          case "sudoku": {
            const validPuzzles = values.sudokuPuzzles
              .map((p) => p.text.trim())
              .filter((text) => text !== "");

            if (validPuzzles.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please provide a functional Sudoku computational string schema.",
                "error",
              );
              return;
            }

            const data_json = {
              title: values.title,
              title_local: values.title_local,
              commonData: {
                type: `${values.sudokuGridType}-${values.sudokuContentType}`,
                title: values.title,
              title_local: values.title_local,
              },
              data: validPuzzles,
            };

            apiPayload = {
              ...basePayload,
              type: "sudoku",
              btn_label: "Play Sudoku",
              data_json: JSON.stringify(data_json),
            };
            break;
          }

          case "mathcrossword": {
            const formattedData = values.mathCrosswordPuzzles
              .filter((p) => p.text.trim() !== "" && p.answer.trim() !== "")
              .map((p) => ({
                text: p.text.trim(),
                answer: p.answer.split(",").map((n) => parseInt(n.trim(), 10)),
              }));

            if (formattedData.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please construct algebraic riddle systems equations blocks completely.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "mathCrossword",
              btn_label: "Play Crossword",
              data_json: JSON.stringify({
                title:
                  values.title ||
                  "Click on the empty cells and fill it with the correct value.",
                data: formattedData,
              }),
            };
            break;
          }

          case "denomination": {
            const formattedQuestions = values.denominationData.questions
              .filter((q) => q.targetAmount !== "")
              .map((q) => ({
                targetAmount: Number(q.targetAmount),
                denominations: q.denominations
                  .filter((d) => d.value !== "" && d.imageUrl !== "")
                  .map((d) => ({
                    value: Number(d.value),
                    imageUrl: d.imageUrl,
                  })),
              }));

            if (formattedQuestions.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please map structural targets against currency elements rules.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "denomination",
              btn_label: "Play Game",
              data_json: JSON.stringify({
                title: values.title || "Make the Exact Amount",
                title_local: values.title_local,
                currencySymbol: values.denominationData.currencySymbol,
                questions: formattedQuestions,
              }),
            };
            break;
          }

          case "balance": {
            for (let i = 0; i < values.balancePuzzles.length; i++) {
              const p = values.balancePuzzles[i];
              if (p.left.trim() === "" && p.right.trim() === "") continue;

              const leftCount = p.left.split(",").length;
              const rightCount = p.right.split(",").length;
              const hasQMark = p.left.includes("?") || p.right.includes("?");

              if (leftCount > 3 || rightCount > 3) {
                Swal.fire(
                  "Validation Error",
                  `Equation #${i + 1
                  }: You can only have a maximum of 3 balls per side.`,
                  "error",
                );
                return;
              }

              if (!hasQMark) {
                Swal.fire(
                  "Validation Error",
                  `Equation #${i + 1
                  }: You must include a '?' indicating the target ball.`,
                  "error",
                );
                return;
              }

              if (!p.options || p.options.trim() === "") {
                Swal.fire(
                  "Validation Error",
                  `Equation #${i + 1
                  }: Please provide tracking value options selections.`,
                  "error",
                );
                return;
              }
            }

            const formattedData = values.balancePuzzles
              .filter((p) => p.left.trim() !== "" || p.right.trim() !== "")
              .map((p) => ({
                left: p.left.trim(),
                right: p.right.trim(),
                options: p.options
                  .split(",")
                  .map((o) => parseInt(o.trim(), 10))
                  .filter((n) => !isNaN(n)),
              }));

            if (formattedData.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please generate operational equations matrices balances properties.",
                "error",
              );
              return;
            }

            apiPayload = {
              ...basePayload,
              type: "balance",
              btn_label: "Balance Numbers",
              data_json: JSON.stringify({
                title:
                  values.title ||
                  "Drag and drop the balls to balance the numbers.",
                data: formattedData,
              }),
            };
            break;
          }

          case "crossword": {
            const validWords = values.crosswordWords.filter(
              (w) => w.answer.trim() !== "" && w.clue.trim() !== "",
            );

            if (validWords.length === 0) {
              Swal.fire(
                "Validation Error",
                "Please completely initialize matrix definitions mapping intersections blocks.",
                "error",
              );
              return;
            }

            const data_json = {
              title: values.title || "वर्ग पहेली (Crossword)",
              rows: Number(values.crosswordRows),
              cols: Number(values.crosswordCols),
              words: validWords.map((w) => ({
                number: Number(w.number),
                clue: w.clue.trim(),
                answer: w.answer.trim().toUpperCase(),
                row: Number(w.row),
                col: Number(w.col),
                direction: w.direction,
              })),
            };

            apiPayload = {
              ...basePayload,
              type: "crossword",
              btn_label: "Play Crossword",
              data_json: JSON.stringify(data_json),
            };
            break;
          }

          default:
            Swal.fire("Error", "Invalid activity type", "error");
            return;
        }
        console.log("SAVE PAYLOAD");
        console.log(apiPayload);

        const requiresApproval = !hasPermission("Approval Queue", "Approve");
        if (requiresApproval) {
          let mappedOldData = null;
          if (isEdit && editData) {
            mappedOldData = {
              id: editData.id,
              card_id: editData.card_id,
              grammar_subcard_id: editData.grammar_subcard_id || null,
              topic_name: editData.topic_name || null,
              grade: editData.grade || null,
              language: editData.language || null,
              curriculum: editData.curriculum || null,
              type: editData.activity_type || editData.type || null,
              sub_activity_type: editData.sub_activity_type || null,
              btn_label: editData.btn_label || editData.btnLabel || null,
              data_json: typeof editData.data_json === "object" ? JSON.stringify(editData.data_json) : editData.data_json
            };
          }

          await post("admin/approval-queue", {
            moduleName: "Exercise type",
            actionType: isEdit ? "EDIT" : "CREATE",
            entityId: isEdit ? apiPayload.id : null,
            oldData: mappedOldData,
            newData: apiPayload,
            requestedBy: user?.email || user?.name || "Unknown"
          });

          Swal.fire({
            title: 'Queued for Approval!',
            text: 'Your request has been sent to the Admin for approval.',
            icon: 'info',
            confirmButtonColor: '#34c38f',
          }).then(() => navigate("/Exercise-type"));

          try {
            await post(POST_NOTIFICATION, {
              receiverId: "admin",
              senderId: user?.name || "admin",
              title: 'New Approval Request',
              message: `${user?.name || "A user"} submitted a request to ${isEdit ? "edit" : "create"} an Exercise.`,
              module: "Exercise type",
              actionType: "APPROVAL",
              referenceId: isEdit ? String(apiPayload.id) : "",
              navigationUrl: "/approval-queue"
            });
            window.dispatchEvent(new Event('notificationAdded'));
          } catch (e) { console.error(e); }

          return;
        }

        const result = await post(SAVE_ACTIVITY, apiPayload);

        if (["success", "inserted", "updated"].includes(result?.status)) {
          Swal.fire("Success", "Saved!", "success").then(() =>
            navigate("/Exercise-type"),
          );
        } else {
          Swal.fire("Error", "Unexpected response from server", "error");
        }
      } catch (error) {
        console.error("Submit Error:", error);
        Swal.fire("Error", error.message, "error");
      }
    },
  });

  // ─── Edit pre-fill useEffect ────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit && editData) {
      let parsedData = {};
      try {
        parsedData =
          typeof editData.data_json === "string"
            ? JSON.parse(editData.data_json)
            : editData.data_json;
      } catch (e) {
        console.error("Parse error", e);
      }

      if (parsedData) {
        let dbType = editData.activity_type || editData.type || "";
        let dbSubType = editData.sub_activity_type || "";

        // Resolve the specific activityType used by form sections and
        // data-parsing logic.  sub_activity_type is preferred when available
        // because it is the most specific key stored.
        let activityType;

        if (dbSubType) {
          // normalizeSubType maps e.g. "balloonPop" → "balloonpop",
          // "jumbledWords" → "jumbledwords", "memoryFlip" → "memoryflip"
          activityType = normalizeSubType(dbSubType) || dbSubType.toLowerCase();
        } else {
          // Fall back to deriving from activity_type (legacy records that have
          // no sub_activity_type stored yet, or standalone types).
          activityType = dbType.toLowerCase();
          if (dbType === "matchByDragDrop") {
            activityType = "match";
          } else if (dbType === "informationProcessing") {
            activityType = parsedData.type === "image" ? "image" : "audio";
          } else if (dbType === "visualInformationProcessing") {
            activityType =
              parsedData.type === "visual_image"
                ? "visual_image"
                : "visual_audio";
          } else if (dbType === "match") {
            activityType = "matchpair";
          } else if (dbType === "ttype") {
            activityType = "ttype";
          } else if (dbType === "rocketFuel") {
            activityType = "rocketfuel";
          }
        }

        // Sync the activityCategory state so the Sub Activity Type dropdown
        // renders correctly in edit / view mode.
        const resolvedCategory = getCategoryFromType(dbType || dbSubType);
        setActivityCategory(resolvedCategory);

        // ── data-parsing local vars ──────────────────────────────────────────
        let recMatch = [{ text: "", answer: "" }];
        let recAudioImage = null;
        let recAudioPlayLimit = "";

        if (
          parsedData &&
          (activityType === "audio" || activityType === "image") &&
          parsedData.questions
        ) {
          const isAudio = activityType === "audio";
          if (isAudio) recAudioPlayLimit = parsedData.playLimit || "";

          recAudioImage = parsedData.questions.map((q) => {
            const opts = q.options
              ? q.options.split(isAudio ? "\n" : ",")
              : ["", "", "", ""];
            return {
              question: q.qText || "",
              answers: opts.length ? opts : ["", "", "", ""],
              correct_answer: "0",
            };
          });
        }

        let recVisualAudioImage = null;
        let recMCQ = null;
        let recClassifySentence = [
          { word: "", options: ["", ""], correct_answer: "0" },
        ];
        let recSequenceItems = [{ text: "" }];
        let recSequenceSubtype = "character";
        let recCompleteWords = [
          { question: "", correct: "", options: ["", ""] },
        ];
        let recMatchPairs = [{ left: "", right: "" }];
        let recSelectWord = [{ sentence: "", answer: "" }];
        let recRightOne = [{ correct: "", wrong: "" }];
        let recFillUp = [{ sentence: "", right: "", wrong: "" }];
        let recGroupData = [{ name: "", text: "" }];
        let recPuzzlePairs = [{ base: "", right: "", wrong: "" }];
        let recDragDropItems = [{ src: "", word: "" }];
        let recWordList = [""];

        let recCrosswordRows = 12;
        let recCrosswordCols = 12;
        let recCrosswordWords = [
          {
            number: 1,
            clue: "",
            answer: "",
            row: 0,
            col: 0,
            direction: "across",
          },
        ];

        let recDenominationData = {
          currencySymbol: "₹",
          questions: [
            { targetAmount: "", denominations: [{ value: "", imageUrl: "" }] },
          ],
        };

        let recTtypeQuestions = [
          { questionText: "", options: ["", "", "", ""], correct_answer: "0" },
        ];

        let recSudokuGridType = "9x9";
        let recSudokuContentType = "numbers";
        let recSudokuPuzzles = [{ text: "" }];
        let recMathCrossword = [{ text: "", answer: "" }];
        let recBalance = [{ left: "1,1,?", right: "8", options: "7,6,8,9" }];
        let recBlockSentences = [{ sentence: "", hint: "" }];

        let recClickAndDragRows = [
          {
            word: "",
            audioSrc: "",
            example1: "",
            example2: "",
            correctImg: "",
            distractor1: "",
            distractor2: "",
          },
        ];

        let recSpeakingCards = [{ image: "", text: "" }];
        let recJumbledQuestions = [{ text: "" }];
        let recWordClimbQuestions = [
          { qText: "", options: ["", "", "", ""], correct_answer: "0" },
        ];
        let recBalloonQuestions = [{ qText: "", correctAnswer: "" }];
        let recRocketQuestions = [{ qText: "", answers: ["", "", "", ""] }];
        let recRocketExtraOptions = "";
        let recCommonOptions = [];
        let recMemoryQuestions = [{ qText: "", answer: "", image: "" }];

        // ── parse speaking cards ─────────────────────────────────────────────
        if (parsedData && activityType === "speakingcards") {
          recSpeakingCards = parsedData.cards || [{ image: "", text: "" }];
        }

        // ── parse rocket fuel ────────────────────────────────────────────────
        if (parsedData && activityType === "rocketfuel" && parsedData.questions) {
          recRocketQuestions = parsedData.questions.map((q) => ({
            qText: q.qText || "",
            answers: Array.isArray(q.answers) ? q.answers : ["", "", "", ""],
          }));
          recRocketExtraOptions = parsedData.extraOptions || "";
        }

        // ── parse memory flip ────────────────────────────────────────────────
        if (parsedData && activityType === "memoryflip") {
          recMemoryQuestions = parsedData.questions || recMemoryQuestions;
        }

        // ── parse jumbled words ──────────────────────────────────────────────
        if (parsedData && activityType === "jumbledwords") {
          recJumbledQuestions = parsedData.questions || [{ text: "" }];
        }

        // ── parse word climb ─────────────────────────────────────────────────
        if (parsedData && activityType === "wordclimb" && parsedData.questions) {
          recWordClimbQuestions = parsedData.questions.map((q) => {
            const rawOptions = q.options.split(",");
            const correctIndex = rawOptions.findIndex((opt) =>
              opt.includes("*"),
            );
            return {
              qText: q.qText,
              options: rawOptions.map((opt) => opt.replace("*", "")),
              correct_answer: correctIndex.toString(),
            };
          });
        }

        // ── parse balloon pop ────────────────────────────────────────────────
        if (parsedData && activityType === "balloonpop" && parsedData.questions) {
          recCommonOptions = parsedData.commonOptions || [];
          recBalloonQuestions = parsedData.questions.map((q) => {
            const rawOptions = q.options.split(",");
            const correctOption =
              rawOptions.find((opt) => opt.includes("*")) || "";
            return {
              qText: q.qText,
              correctAnswer: correctOption.replace("*", ""),
            };
          });
        }

        // ── parse match (matchByDragDrop) ────────────────────────────────────
        if (parsedData.text && activityType === "match") {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recMatch = lines.map((line) => {
            const match = line.match(/(.*?)\*(.*?)\*(.*)/);
            if (match) {
              const prefix = match[1].trim();
              const answer = match[2].trim();
              const suffix = match[3].trim();
              let fullSentence = prefix;
              if (suffix) fullSentence = `${prefix} ___ ${suffix}`;
              else if (prefix) fullSentence = `${prefix} ___`;
              return { text: fullSentence, answer: answer };
            }
            return { text: line, answer: "" };
          });
        }

        // ── parse audio/image ────────────────────────────────────────────────
        if (
          parsedData &&
          (activityType === "audio" || activityType === "image") &&
          parsedData.questions
        ) {
          const isAudio = activityType === "audio";
          recAudioImage = parsedData.questions.map((q) => {
            const opts = q.options
              ? q.options.split(isAudio ? "\n" : ",")
              : ["", "", "", ""];
            return {
              question: q.qText || "",
              answers: opts.length ? opts : ["", "", "", ""],
              correct_answer: "0",
            };
          });
        }

        // ── parse visual audio/image ─────────────────────────────────────────
        if (
          parsedData &&
          (activityType === "visual_audio" || activityType === "visual_image") &&
          parsedData.questions
        ) {
          recVisualAudioImage = parsedData.questions.map((q) => {
            return {
              question: q.qText || q.question || "",
              answers: Array.isArray(q.options) ? q.options : ["", "", "", ""],
              correct_answer: q.correct_answer || "0",
            };
          });
        }

        // ── parse drag and drop ──────────────────────────────────────────────
        if (parsedData && activityType === "draganddrop" && parsedData.words) {
          recDragDropItems = parsedData.words.map((w, idx) => ({
            word: w.word || "",
            src: parsedData.svg?.paths?.[idx]?.src || "",
          }));
        }

        const dDropSource =
          parsedData.data && parsedData.data.words ? parsedData.data : parsedData;
        if (dDropSource && activityType === "draganddrop" && dDropSource.words) {
          recDragDropItems = dDropSource.words.map((w, idx) => {
            const imagePaths =
              dDropSource.svg?.paths?.filter((p) => p.type === "image") || [];
            let matchedImg = imagePaths[idx] || imagePaths[0];
            return {
              word: w.word || "",
              src: matchedImg?.src || dDropSource.svg?.paths?.[idx]?.src || "",
            };
          });
        }

        // ── parse MCQ ────────────────────────────────────────────────────────
        if (parsedData && activityType === "mcq" && parsedData.questions) {
          recMCQ = parsedData.questions.map((q) => {
            let rawOptionsArray = Array.isArray(q.options)
              ? q.options
              : typeof q.options === "string"
                ? q.options.split("\n")
                : [];
            const correctIndex = rawOptionsArray.findIndex((opt) =>
              String(opt).trim().startsWith("*"),
            );
            const cleanOptions = rawOptionsArray.map((opt) =>
              String(opt).replace(/\*/g, "").trim(),
            );
            while (cleanOptions.length < 4) cleanOptions.push("");
            return {
              question: q.qText || q.question || "",
              answers: cleanOptions.slice(0, 4),
              correct_answer: correctIndex > -1 ? correctIndex.toString() : "0",
            };
          });
        }

        // ── parse block sentence ─────────────────────────────────────────────
        if (parsedData && activityType === "blocksentence" && parsedData.text) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recBlockSentences = lines.map((line) => {
            const parts = line.split("|").map((s) => s.trim());
            return { sentence: parts[0] || "", hint: parts[1] || "" };
          });
        }

        // ── parse sequence ───────────────────────────────────────────────────
        if (parsedData && activityType === "sequence" && parsedData.text) {
          const rawText = parsedData.text;
          const isWordSequence = rawText.includes("\n\n");
          const lines = rawText
            .split(isWordSequence ? "\n\n" : "\n")
            .filter((l) => l.trim() !== "");
          recSequenceItems = lines.map((line) => ({
            text: !isWordSequence ? line.replace(/\s+/g, "") : line,
          }));
          recSequenceSubtype = isWordSequence ? "word" : "character";
        }

        // ── parse complete word ──────────────────────────────────────────────
        if (parsedData && activityType === "completeword" && parsedData.text) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recCompleteWords = lines.map((line) => {
            const [word, correct, question, optionsStr] = line.split("|");
            return {
              question: question || "",
              correct: correct || "",
              options: optionsStr ? optionsStr.split(",") : ["", ""],
            };
          });
        }

        // ── parse match pair ─────────────────────────────────────────────────
        if (activityType === "matchpair" && parsedData.text) {
          if (parsedData.text.includes(",")) {
            const lines = parsedData.text
              .split("\n")
              .filter((l) => l.trim() !== "");
            recMatchPairs = lines.map((line) => {
              const [left, right] = line.split(",");
              return { left: left?.trim() || "", right: right?.trim() || "" };
            });
          }
        }

        // ── parse select word ────────────────────────────────────────────────
        if (parsedData && activityType === "selectword" && parsedData.text) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recSelectWord = lines.map((line) => {
            const match = line.match(/\*(.*?)\*/);
            return {
              sentence: line.replace(/\*/g, ""),
              answer: match ? match[1] : "",
            };
          });
        }

        // ── parse right one ──────────────────────────────────────────────────
        if (parsedData && activityType === "rightone" && parsedData.text) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recRightOne = lines.map((line) => {
            const [correct, wrong] = line.split(",");
            return { correct: correct || "", wrong: wrong || "" };
          });
        }

        // ── parse fill up ────────────────────────────────────────────────────
        if (parsedData && activityType === "fillup" && parsedData.text) {
          const lines = parsedData.text
            .split(/\n+/)
            .filter((l) => l.trim() !== "");
          recFillUp = lines.map((line) => {
            const match = line.match(/\*(.*?) \((.*?)\)\*/);
            return {
              sentence: line.replace(/\*.*?\*/, "___"),
              right: match ? match[1].trim() : "",
              wrong: match ? match[2].trim() : "",
            };
          });
        }

        // ── parse group ──────────────────────────────────────────────────────
        if (parsedData && activityType === "group" && parsedData.types) {
          recGroupData = parsedData.types;
        }

        // ── parse complete puzzle ────────────────────────────────────────────
        if (parsedData && activityType === "completepuzzle" && parsedData.text) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recPuzzlePairs = lines.map((line) => {
            const parts = line.split(",").map((s) => s.trim());
            return {
              base: parts[0] || "",
              right: parts[1] || "",
              wrong: parts[2] || "",
            };
          });
        }

        // ── parse classify sentence ──────────────────────────────────────────
        if (
          parsedData &&
          activityType === "classifysentence" &&
          parsedData.text
        ) {
          const lines = parsedData.text
            .split("\n")
            .filter((l) => l.trim() !== "");
          recClassifySentence = lines.map((line) => {
            const parts = line.split("|").map((p) => p.trim());
            const word = parts[0] || "";
            const optionsStr = parts[2] || "";
            const rawOptions = optionsStr.split(",").map((o) => o.trim());
            const correctIndex = rawOptions.findIndex((opt) =>
              opt.startsWith("*"),
            );
            const cleanOptions = rawOptions.map((opt) =>
              opt.replace(/\*/g, ""),
            );
            return {
              word: word,
              options: cleanOptions.length > 0 ? cleanOptions : ["", ""],
              correct_answer: correctIndex > -1 ? correctIndex.toString() : "0",
            };
          });
        }

        // ── parse word search ────────────────────────────────────────────────
        if (parsedData && activityType === "wordsearch" && parsedData.words) {
          recWordList = parsedData.words.map((wObj) => {
            if (Array.isArray(wObj.word)) return wObj.word.join("");
            if (typeof wObj.word === "string") return wObj.word;
            return "";
          });
          if (recWordList.length === 0) recWordList = [""];
        }

        // ── parse ttype ──────────────────────────────────────────────────────
        if (parsedData && activityType === "ttype" && parsedData.questions) {
          recTtypeQuestions = parsedData.questions.map((q) => {
            const options = Array.isArray(q.options)
              ? q.options
              : ["", "", "", ""];
            const correctStr = q.correct || "";
            let correctIdx = options.findIndex(
              (opt) => opt.trim() === correctStr.trim(),
            );
            if (correctIdx === -1) correctIdx = 0;
            return {
              questionText: q.questionText || "",
              options: options,
              correct_answer: correctIdx.toString(),
            };
          });
        }

        // ── parse click and drag ─────────────────────────────────────────────
        if (parsedData && activityType === "clickanddrag" && parsedData.rows) {
          recClickAndDragRows = parsedData.rows.map((r) => ({
            word: r.word || "",
            audioSrc: r.audioSrc || "",
            example1: r.examples?.[0]?.src || "",
            example2: r.examples?.[1]?.src || "",
            correctImg: r.correctAnswer?.src || "",
            distractor1: r.distractors?.[0]?.src || "",
            distractor2: r.distractors?.[1]?.src || "",
          }));
        }

        // ── parse denomination ───────────────────────────────────────────────
        if (
          parsedData &&
          activityType === "denomination" &&
          parsedData.questions
        ) {
          recDenominationData = {
            currencySymbol: parsedData.currencySymbol || "₹",
            questions: parsedData.questions.map((q) => ({
              targetAmount: q.targetAmount || "",
              denominations:
                q.denominations && q.denominations.length > 0
                  ? q.denominations.map((d) => ({
                    value: d.value || "",
                    imageUrl: d.imageUrl || "",
                  }))
                  : [{ value: "", imageUrl: "" }],
            })),
          };
        }

        // ── parse sudoku ─────────────────────────────────────────────────────
        if (parsedData && activityType === "sudoku") {
          if (parsedData.commonData && parsedData.commonData.type) {
            const parts = parsedData.commonData.type.split("-");
            if (parts.length >= 2) {
              recSudokuGridType = parts[0];
              recSudokuContentType = parts[1];
            }
          }
          if (Array.isArray(parsedData.data)) {
            recSudokuPuzzles = parsedData.data.map((gridString) => {
              return {
                text:
                  typeof gridString === "string"
                    ? gridString
                    : gridString.text || "",
              };
            });
          }
        }

        // ── parse math crossword ─────────────────────────────────────────────
        if (parsedData && activityType === "mathcrossword" && parsedData.data) {
          recMathCrossword = parsedData.data.map((p) => ({
            text: p.text || "",
            answer: Array.isArray(p.answer) ? p.answer.join(", ") : "",
          }));
        }

        // ── parse balance ────────────────────────────────────────────────────
        if (parsedData && activityType === "balance" && parsedData.data) {
          recBalance = parsedData.data.map((p) => ({
            left: p.left || "",
            right: p.right || "",
            options: p.options
              ? Array.isArray(p.options)
                ? p.options.join(",")
                : p.options
              : "",
          }));
        }

        // ── parse crossword ──────────────────────────────────────────────────
        if (parsedData && activityType === "crossword") {
          recCrosswordRows = parsedData.rows || 12;
          recCrosswordCols = parsedData.cols || 12;
          if (Array.isArray(parsedData.words) && parsedData.words.length > 0) {
            recCrosswordWords = parsedData.words;
          }
        }

        // ── push everything into Formik ──────────────────────────────────────
        validation.setValues({
          ...validation.initialValues,
          id: editData.id,
          label: editData.label || "",
          btn_label: editData.btn_label || "Fill Up by Drag",
          // activityType is now reliably resolved above (sub_activity_type first)
          type: activityType,
          activity_category: dbType,
          sub_activity_type: normalizeSubType(dbSubType) || activityType,
          card_id: editData.card_id || "",
          grammar_subcard: editData.grammar_subcard_id || "",
          grade: editData.grade || "",
          language: editData.language || "",
          curriculum: editData.curriculum || "",
          topic_name: editData.topic_name || "",
          title: parsedData.title || "",
          title_local: parsedData.title_local || "",

          questions:
            activityType === "mcq"
              ? recMCQ
              : activityType === "classifysentence"
                ? recClassifySentence
                : activityType === "audio" || activityType === "image"
                  ? recAudioImage
                  : activityType === "visual_audio" ||
                    activityType === "visual_image"
                    ? recVisualAudioImage
                    : [{ text: "", answer: "" }],

          audioUrl: parsedData.audio || "",
          imageUrl: parsedData.image || "",
          questionsLater: parsedData.questionsLater ?? true,
          audioPlayLimit: recAudioPlayLimit,
          denominationData: recDenominationData,
          clickAndDragRows: recClickAndDragRows,
          sequenceItems: recSequenceItems,
          speakingCards: recSpeakingCards,
          jumbledQuestions: recJumbledQuestions,
          wordClimbQuestions: recWordClimbQuestions,
          memoryQuestions: recMemoryQuestions,
          rocketQuestions: recRocketQuestions,
          rocketExtraOptions: recRocketExtraOptions,
          commonOptions: recCommonOptions,
          balloonQuestions: recBalloonQuestions,
          sequenceSubtype: recSequenceSubtype,
          completeWords: recCompleteWords,
          matchPairs: recMatchPairs,
          selectWordQuestions: recSelectWord,
          rightOnePairs: recRightOne,
          fillUpQuestions: recFillUp,
          groupData: recGroupData,
          puzzlePairs: recPuzzlePairs,
          blockSentences: recBlockSentences,
          dragDropItems: recDragDropItems,
          wordList: recWordList,

          ttypeQuestions:
            activityType === "ttype"
              ? recTtypeQuestions
              : [
                {
                  questionText: "",
                  options: ["", "", "", ""],
                  correct_answer: "0",
                },
              ],

          sudokuGridType: recSudokuGridType,
          sudokuContentType: recSudokuContentType,
          sudokuPuzzles: recSudokuPuzzles,
          mathCrosswordPuzzles: recMathCrossword,
          balancePuzzles: recBalance,

          crosswordRows: recCrosswordRows,
          crosswordCols: recCrosswordCols,
          crosswordWords: recCrosswordWords,

          generatedTable: Array.isArray(parsedData.table)
            ? parsedData.table
            : [],
          generatedWords: Array.isArray(parsedData.words)
            ? parsedData.words
            : [],
        });
      }
    }
  }, [editData]);

  const isGrammarCard = !!cards.find(
    (c) =>
      String(c.id) === String(validation.values.card_id) &&
      c.label?.toLowerCase().includes("grammar")
  );

  return (
    <div className="page-content">
      <Breadcrumbs
        title="Exercise Management"
        breadcrumbItem={
          isViewOnly
            ? "View Activity"
            : isEdit
              ? "Edit Activity"
              : "Add New Activity"
        }
      />
      <FormikProvider value={validation}>
        <Form onSubmit={validation.handleSubmit}>
          {/* ── 1. General Information ──────────────────────────────────── */}
          <Card className="mb-3">
            <CardBody
              style={{
                pointerEvents: isViewOnly ? "none" : "auto",
                opacity: isViewOnly ? 0.9 : 1,
              }}
            >
              <h5 className="card-title mb-4">1. General Information</h5>

              <Row>
                <Col md={4}>
                  <Label>Grade</Label>
                  <Input
                    type="select"
                    style={commonInputStyle}
                    {...validation.getFieldProps("grade")}
                    invalid={
                      !!(validation.touched.grade && validation.errors.grade)
                    }
                  >
                    <option value="">Select Grade</option>
                    {fieldOptions.grades?.map((grade, index) => (
                      <option key={index} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </Input>
                  {validation.touched.grade && validation.errors.grade && (
                    <FormFeedback type="invalid">
                      {validation.errors.grade}
                    </FormFeedback>
                  )}
                </Col>

                <Col md={4}>
                  <Label>Language</Label>
                  <Input
                    type="select"
                    style={commonInputStyle}
                    {...validation.getFieldProps("language")}
                    invalid={
                      !!(
                        validation.touched.language &&
                        validation.errors.language
                      )
                    }
                  >
                    <option value="">Select Language</option>
                    {fieldOptions.languages?.map((lang, index) => (
                      <option key={index} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </Input>
                  {validation.touched.language &&
                    validation.errors.language && (
                      <FormFeedback type="invalid">
                        {validation.errors.language}
                      </FormFeedback>
                    )}
                </Col>

                <Col md={4}>
                  <Label>Curriculum</Label>
                  <Input
                    type="select"
                    style={commonInputStyle}
                    {...validation.getFieldProps("curriculum")}
                    invalid={
                      !!(
                        validation.touched.curriculum &&
                        validation.errors.curriculum
                      )
                    }
                  >
                    <option value="">Select Curriculum</option>
                    {fieldOptions.curriculums?.map((curr, index) => (
                      <option key={index} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </Input>
                  {validation.touched.curriculum &&
                    validation.errors.curriculum && (
                      <FormFeedback type="invalid">
                        {validation.errors.curriculum}
                      </FormFeedback>
                    )}
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* ── 2. Configuration ────────────────────────────────────────── */}
          <Card className="mb-3">
            <CardBody
              style={{
                pointerEvents: isViewOnly ? "none" : "auto",
                opacity: isViewOnly ? 0.9 : 1,
              }}
            >
              <h5 className="card-title mb-4">2. Configuration</h5>
              <Row>
                {/* Card (Topic) */}
                <Col md={3}>
                  <Label>Select Card </Label>
                  {loadingCards ? (
                    <Spinner size="sm" color="primary" className="ms-2" />
                  ) : (
                    <Input
                      type="select"
                      style={commonInputStyle}
                      {...validation.getFieldProps("card_id")}
                    >
                      <option value="">-- Choose a Card --</option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Input>
                  )}
                </Col>

                {/* Grammar Subcard — only when card is a grammar card */}
                {cards.find(
                  (c) =>
                    String(c.id) === String(validation.values.card_id) &&
                    c.label?.toLowerCase().includes("grammar"),
                ) && (
                    <Col md={3}>
                      <Label>Grammar Subcard</Label>
                      <Input
                        type="select"
                        style={commonInputStyle}
                        value={validation.values.grammar_subcard}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedSubcard = grammarSubcards.find(
                            (s) => String(s.id) === selectedId
                          );
                          validation.setFieldValue("grammar_subcard", selectedId);
                          validation.setFieldValue(
                            "topic_name",
                            selectedSubcard?.label || ""
                          );
                        }}
                      >
                        <option value="">Select Subcard</option>
                        {grammarSubcards.map((subcard) => (
                          <option key={subcard.id} value={subcard.id}>
                            {subcard.label}
                          </option>
                        ))}
                      </Input>
                    </Col>
                  )}

                {/* Topic Name */}
                <Col md={3}>
                  <Label>Topic Name</Label>
                  <Input
                    type="text"
                    list="topic-options"
                    placeholder="Select or Add Topic"
                    style={commonInputStyle}
                    {...validation.getFieldProps("topic_name")}
                  />
                </Col>

                {/* Activity Type */}
                <Col md={3}>
                  <Label>Activity Type</Label>
                  <Input
                    type="select"
                    style={commonInputStyle}
                    value={activityCategory || validation.values.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (ACTIVITY_CATEGORIES[val]) {
                        // It's a grouped category — show Sub Activity Type dropdown
                        setActivityCategory(val);
                        validation.setFieldValue("type", "");
                        validation.setFieldValue("sub_activity_type", "");
                      } else {
                        // Standalone type — no subtype needed
                        setActivityCategory("");
                        validation.setFieldValue("type", val);
                        validation.setFieldValue("sub_activity_type", "");
                      }
                    }}
                  >
                    <option value="">Select Type</option>

                    {/* Grouped categories (have subtypes) */}
                    <option value="mcq">MCQ</option>
                    <option value="visualinfo">Visual Info</option>
                    <option value="infoprocessing">Info Processing</option>
                    <option value="sequence">Sequence</option>
                    <option value="dragdrop">Drag &amp; Drop</option>

                    {/* Standalone types (no subtype) */}
                    <option value="completeword">Complete Word</option>
                    <option value="classifysentence">Pick the Right Option</option>
                    <option value="wordsearch">Word Search</option>
                    <option value="matchpair">Match Pair</option>
                    <option value="selectword">Select Word</option>
                    <option value="rightone">Right One (Choose Correct Word)</option>
                    <option value="fillup">Fill Up</option>
                    <option value="group">Group Sorting</option>
                    <option value="completepuzzle">Complete Puzzle</option>
                    <option value="clickanddrag">Vocabulary Building</option>
                    <option value="crossword">Crossword (वर्ग पहेली)</option>
                  </Input>
                </Col>

                {/* Sub Activity Type — only visible when a grouped category is selected */}
                {activityCategory && (
                  <Col md={3}>
                    <Label>Sub Activity Type</Label>
                    <Input
                      type="select"
                      style={commonInputStyle}
                      value={validation.values.type}
                      onChange={(e) => {
                        validation.setFieldValue("type", e.target.value);
                        validation.setFieldValue("sub_activity_type", e.target.value);
                      }}
                      invalid={
                        validation.touched.type && !!validation.errors.type
                      }
                    >
                      <option value="">Select Sub Type</option>
                      {(ACTIVITY_CATEGORIES[activityCategory]?.types || []).map(
                        (t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        )
                      )}
                    </Input>
                    {validation.touched.type && validation.errors.type && (
                      <FormFeedback>{validation.errors.type}</FormFeedback>
                    )}
                  </Col>
                )}

                {/* Activity Label */}
                <Col md={3} className={isGrammarCard ? "mt-3" : ""}>
                  <Label>Activity Label</Label>
                  <Input
                    type="text"
                    placeholder="Enter activity label"
                    style={commonInputStyle}
                    {...validation.getFieldProps("label")}
                  />
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* ── 3. Content Data ──────────────────────────────────────────── */}
          <Card className="mb-3">
            <CardBody
              style={{
                pointerEvents: isViewOnly ? "none" : "auto",
                opacity: isViewOnly ? 0.9 : 1,
              }}
            >
              <h5 className="card-title mb-4">3. Content Data</h5>
              <div className="mb-4">
                {validation.values.language && validation.values.language.toLowerCase() !== "english" && (
                  <div className="mb-3">
                    <Label>{validation.values.language} Title</Label>
                    <Input
                      type="text"
                      {...validation.getFieldProps("title_local")}
                      placeholder={`e.g. Enter ${validation.values.language} title`}
                    />
                  </div>
                )}
                <div>
                  <Label>English Title</Label>
                  <Input
                    type="text"
                    {...validation.getFieldProps("title")}
                    placeholder="e.g. Select the correct answer"
                  />
                </div>
              </div>
              <hr />

              {(validation.values.type === "audio" ||
                validation.values.type === "image") && (
                  <InformationProcessingSection
                    validation={validation}
                    isViewOnly={isViewOnly}
                  />
                )}

              {(validation.values.type === "visual_audio" ||
                validation.values.type === "visual_image") && (
                  <VisualInfoProcessingSection
                    validation={validation}
                    isViewOnly={isViewOnly}
                  />
                )}

              {validation.values.type === "denomination" && (
                <DenominationSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}

              {validation.values.type === "mcq" && (
                <FieldArray name="questions">
                  {({ push, remove }) => (
                    <>
                      {validation.values.questions.map((_, index) => (
                        <div
                          key={index}
                          className="p-3 mb-3 border rounded bg-light"
                        >
                          <div className="d-flex justify-content-between mb-2">
                            <h6 className="m-0 text-primary">
                              Question {index + 1}
                            </h6>
                            {!isViewOnly && (
                              <Button
                                color="danger"
                                size="sm"
                                outline
                                onClick={() => remove(index)}
                              >
                                <i className="mdi mdi-delete"></i>
                              </Button>
                            )}
                          </div>
                          <MCQSection index={index} validation={validation} />
                        </div>
                      ))}
                      {!isViewOnly && (
                        <Button
                          color="success"
                          onClick={() =>
                            push({
                              question: "",
                              answers: ["", "", "", ""],
                              correct_answer: "0",
                            })
                          }
                        >
                          + Add Question
                        </Button>
                      )}
                    </>
                  )}
                </FieldArray>
              )}

              {validation.values.type === "match" && (
                <MatchBySection validation={validation} />
              )}
              {validation.values.type === "completeword" && (
                <CompleteWordSection validation={validation} />
              )}
              {validation.values.type === "sequence" && (
                <SequenceSection validation={validation} />
              )}

              {validation.values.type === "classifysentence" && (
                <FieldArray name="questions">
                  {({ push, remove }) => (
                    <>
                      {validation.values.questions.map((_, index) => (
                        <div
                          key={index}
                          className="p-3 mb-3 border rounded bg-light"
                        >
                          <div className="d-flex justify-content-between mb-2">
                            <h6 className="m-0 text-primary">
                              Question {index + 1}
                            </h6>
                            {!isViewOnly && (
                              <Button
                                color="danger"
                                size="sm"
                                outline
                                onClick={() => remove(index)}
                              >
                                <i className="mdi mdi-delete"></i>
                              </Button>
                            )}
                          </div>
                          <ClassifySentenceSection
                            index={index}
                            validation={validation}
                          />
                        </div>
                      ))}
                      {!isViewOnly && (
                        <Button
                          color="success"
                          onClick={() =>
                            push({
                              word: "",
                              options: ["", ""],
                              correct_answer: "0",
                            })
                          }
                        >
                          + Add Question
                        </Button>
                      )}
                    </>
                  )}
                </FieldArray>
              )}

              {validation.values.type === "wordsearch" && (
                <WordSearchSection
                  values={validation.values}
                  setFieldValue={validation.setFieldValue}
                />
              )}
              {validation.values.type === "matchpair" && (
                <MatchPairSection validation={validation} />
              )}
              {validation.values.type === "selectword" && (
                <SelectWordSection validation={validation} />
              )}
              {validation.values.type === "rightone" && (
                <RightOneSection validation={validation} />
              )}
              {validation.values.type === "fillup" && (
                <FillUpSection validation={validation} />
              )}
              {validation.values.type === "group" && (
                <GroupSection validation={validation} />
              )}
              {validation.values.type === "completepuzzle" && (
                <CompletePuzzleSection validation={validation} />
              )}
              {validation.values.type === "draganddrop" && (
                <DragAndDropSection validation={validation} />
              )}

              {validation.values.type === "clickanddrag" && (
                <ClickAndDragSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}

              {validation.values.type === "sudoku" && (
                <SudokuSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}
              {validation.values.type === "mathcrossword" && (
                <MathCrosswordSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}
              {validation.values.type === "balance" && (
                <BalanceSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}

              {validation.values.type === "speakingcards" && (
                <SpeakingCardsSection validation={validation} />
              )}
              {validation.values.type === "jumbledwords" && (
                <JumbledWordsSection validation={validation} />
              )}
              {validation.values.type === "wordclimb" && (
                <WordClimbSection validation={validation} />
              )}
              {validation.values.type === "balloonpop" && (
                <BalloonPopSection validation={validation} />
              )}
              {validation.values.type === "memoryflip" && (
                <MemoryFlipSection validation={validation} />
              )}

              {validation.values.type === "rocketfuel" && (
                <RocketFuelSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}

              {validation.values.type === "crossword" && (
                <CrosswordSection
                  validation={validation}
                  isViewOnly={isViewOnly}
                />
              )}

              {validation.values.type === "ttype" && (
                <FieldArray name="ttypeQuestions">
                  {({ push, remove }) => (
                    <>
                      {validation.values.ttypeQuestions.map((_, index) => (
                        <div
                          key={index}
                          className="p-3 mb-3 border rounded bg-light"
                        >
                          <div className="d-flex justify-content-between mb-2">
                            <h6 className="m-0 text-primary">
                              Snake Level {index + 1}
                            </h6>
                            {!isViewOnly && (
                              <Button
                                color="danger"
                                size="sm"
                                outline
                                onClick={() => remove(index)}
                              >
                                <i className="mdi mdi-delete"></i>
                              </Button>
                            )}
                          </div>
                          <TtypeSection index={index} validation={validation} />
                        </div>
                      ))}
                      {!isViewOnly && (
                        <Button
                          color="success"
                          onClick={() =>
                            push({
                              questionText: "",
                              options: ["", "", "", ""],
                              correct_answer: "0",
                            })
                          }
                        >
                          + Add Level
                        </Button>
                      )}
                    </>
                  )}
                </FieldArray>
              )}

              {!validation.values.type && (
                <div className="text-center p-5 border rounded bg-light text-muted">
                  Please select an <strong>Activity Type</strong> to start
                  adding content.
                </div>
              )}
            </CardBody>
          </Card>

          <div className="d-flex justify-content-end gap-2 mb-5">
            <Button
              color="secondary"
              onClick={() => navigate("/Exercise-type")}
            >
              {isViewOnly ? "Close" : "Cancel"}
            </Button>
            {!isViewOnly && (
              <Button color="primary" type="submit">
                {isEdit ? "Update Activity" : "Create Activity"}
              </Button>
            )}
          </div>
        </Form>
      </FormikProvider>
    </div>
  );
}

export default InvoicesDetail;
