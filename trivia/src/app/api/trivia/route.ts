import { NextResponse } from "next/server";

type Difficulty = "easy" | "medium" | "hard";
type Kind = "boolean" | "multiple";

type TriviaNormalized =
  | {
      id: string;
      type: "boolean";
      difficulty: Difficulty;
      question: string;
      choices: ["True", "False"];
      correctAnswer: "True" | "False";
      category: string;
    }
  | {
      id: string;
      type: "multiple";
      difficulty: Difficulty;
      question: string;
      choices: string[];
      correctAnswer: string;
      category: string;
    };

// small decoder for OpenTDB entities
function decodeHTMLEntities(str: string) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// --- API handlers ---
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "boolean") as "boolean" | "multiple";
  const difficulty = (searchParams.get("difficulty") ?? "easy") as "easy" | "medium" | "hard";

  try {
    const url = `https://opentdb.com/api.php?amount=1&type=${encodeURIComponent(type)}&difficulty=${encodeURIComponent(difficulty)}`;
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    if (!data || data.response_code !== 0 || !data.results?.length) {
      // fallback sample if upstream fails
      const fallback =
        type === "boolean"
          ? {
              id: "fb-1",
              type: "boolean" as const,
              difficulty,
              question: "The sky is blue.",
              choices: ["True", "False"] as const,
              correctAnswer: "True" as const,
              category: "Science",
            }
          : {
              id: "fb-2",
              type: "multiple" as const,
              difficulty,
              question: "What is 2 + 2?",
              choices: ["3", "4", "5", "22"],
              correctAnswer: "4",
              category: "Mathematics",
            };

      return cors(NextResponse.json(fallback));
    }

    const q = data.results[0] as {
      type: "boolean" | "multiple";
      difficulty: "easy" | "medium" | "hard";
      question: string;
      correct_answer: string;
      incorrect_answers: string[];
      category: string;
    };

    const question = decodeHTMLEntities(q.question);
    const correct = decodeHTMLEntities(q.correct_answer);
    const incorrect = q.incorrect_answers.map(decodeHTMLEntities);

    const normalized: TriviaNormalized =
      q.type === "boolean"
        ? {
            id: crypto.randomUUID(),
            type: "boolean",
            difficulty: q.difficulty,
            question,
            choices: ["True", "False"],
            correctAnswer: correct === "True" ? "True" : "False",
            category: q.category,
          }
        : {
            id: crypto.randomUUID(),
            type: "multiple",
            difficulty: q.difficulty,
            question,
            choices: shuffle([correct, ...incorrect]),
            correctAnswer: correct,
            category: q.category,
          };

    // ✅ Add CORS headers here
    return cors(NextResponse.json(normalized));
  } catch (err) {
    console.error("Backend error:", err);
    // still return a valid question so the UI never sees 5xx
    const fallback = {
      id: "fb-x",
      type: "boolean" as const,
      difficulty,
      question: "Fallback question (network error). True?",
      choices: ["True", "False"] as const,
      correctAnswer: "True" as const,
      category: "General",
    };
    return cors(NextResponse.json(fallback));
  }
}

// Handle preflight requests from the browser
export async function OPTIONS() {
  return cors(new Response(null));
}

// --- CORS helper (edit origin to match your Vite dev URL if needed) ---
function cors(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}


