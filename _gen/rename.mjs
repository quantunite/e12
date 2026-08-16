import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("index.html", "utf8");
const subs = [
  [/#gates/g, "#clubs"],
  [/id="gates"/g, 'id="clubs"'],
  [/tab\.gates/g, "tab.clubs"],
  [/gates\.(eyebrow|h2b|h2|lead)/g, "clubs.$1"],
  [/gate1\./g, "club1."],
  [/gate2\./g, "club2."],
  [/gate3\./g, "club3."],
  [/gate-feature/g, "club-feature"],
  [/gates-soon/g, "clubs-soon"],
  [/gate-soon/g, "club-soon"],
  [/the gate cards/g, "the club cards"],
  [/the live gate gets/g, "the live club gets"],
  [/the gates still to open/g, "the clubs still to open"],
  [/<!-- Gate 01: live -->/g, "<!-- Club 01: live -->"],
  [/<!-- Gates still to open -->/g, "<!-- Clubs still to open -->"],
  [/GATES ====/g, "CLUBS ===="],
];
for (const [re, to] of subs) c = c.replace(re, to);
writeFileSync("index.html", c);
console.log("identifiers renamed");
