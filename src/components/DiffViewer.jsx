// Minimal unified-diff parser — enough for GitHub's .diff output.
function parseDiff(diffText) {
  if (!diffText) return [];
  const lines = diffText.split("\n");
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      currentFile = { name: "", hunks: [] };
      files.push(currentFile);
      currentHunk = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      if (currentFile) {
        const path = line.slice(4).trim();
        currentFile.name = path === "/dev/null" ? currentFile.name : path.replace(/^b\//, "");
      }
      continue;
    }
    if (line.startsWith("--- ")) {
      if (currentFile && !currentFile.name) {
        const path = line.slice(4).trim();
        currentFile.name = path === "/dev/null" ? "" : path.replace(/^a\//, "");
      }
      continue;
    }
    if (line.startsWith("@@")) {
      currentHunk = { header: line, lines: [] };
      currentFile?.hunks.push(currentHunk);
      continue;
    }
    if (!currentHunk) continue;

    if (line.startsWith("+")) currentHunk.lines.push({ type: "add", text: line.slice(1) });
    else if (line.startsWith("-")) currentHunk.lines.push({ type: "del", text: line.slice(1) });
    else if (line.startsWith("\\")) continue;
    else currentHunk.lines.push({ type: "ctx", text: line.slice(1) });
  }

  return files.filter((f) => f.hunks.length > 0);
}

const LINE_STYLE = {
  add: "bg-emerald-500/10 text-emerald-300",
  del: "bg-red-500/10 text-red-300",
  ctx: "text-zinc-500",
};
const LINE_PREFIX = { add: "+", del: "-", ctx: " " };

export default function DiffViewer({ diffText, onCommentLine }) {
  const files = parseDiff(diffText);

  if (files.length === 0) {
    return <div className="text-sm text-zinc-600 p-4">No parsable diff content.</div>;
  }

  return (
    <div className="space-y-4">
      {files.map((file, fi) => (
        <div key={fi} className="border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs font-mono text-zinc-400">{file.name}</div>
          <div className="font-mono text-[12.5px] leading-5 overflow-x-auto">
            {file.hunks.map((hunk, hi) => (
              <div key={hi}>
                <div className="px-3 py-1 bg-zinc-900/60 text-zinc-600">{hunk.header}</div>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    onClick={() => onCommentLine?.(file.name, `${LINE_PREFIX[line.type]}${li}`, line.text)}
                    className={`px-3 whitespace-pre flex ${LINE_STYLE[line.type]} ${onCommentLine ? "cursor-pointer hover:brightness-125" : ""}`}
                  >
                    <span className="w-4 shrink-0 select-none opacity-60">{LINE_PREFIX[line.type]}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
