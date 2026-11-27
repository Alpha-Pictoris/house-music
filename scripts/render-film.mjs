import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { boardCommand, officeSettings } from "../archive-worker/office-settings.js";

// Renders the film for AV/98/019: four seconds of static, looped by the page, with the board's
// address from BOARD_HOST, BOARD_PORT and BOARD_USER showing through. Needs ffmpeg with drawtext.
const output = fileURLToPath(new URL("../archive/assets/riggers-yard.mp4", import.meta.url));
const captions = {
  command: boardCommand(officeSettings().board),
  stamp: "12 NOV 1998  21:47",
  play: "PLAY",
};

const work = await mkdtemp(join(tmpdir(), "riggers-yard-film-"));
try {
  const text = {};
  for (const [name, caption] of Object.entries(captions)) {
    text[name] = join(work, name + ".txt");
    await writeFile(text[name], caption);
  }
  const type = (file, style) => `drawtext=textfile=${file}:font=monospace:${style}`;
  const label = "fontsize=18:box=1:boxcolor=black@0.5:boxborderw=6";
  // Coarse grain keeps the static small to download. The dark band keeps the address readable.
  const film = [
    "nullsrc=s=160x120:r=12.5:d=4",
    "geq=lum='40+random(1)*150':cb=128:cr=128",
    "scale=640:480:flags=neighbor",
    "drawbox=y=196:h=88:color=black@0.62:t=fill",
    type(text.command, "fontsize=24:fontcolor=0x7dffa2:x=(w-text_w)/2:y=(h-text_h)/2"),
    type(text.stamp, label + ":fontcolor=0xffd9a0:x=w-text_w-26:y=h-text_h-26"),
    type(text.play, label + ":fontcolor=white:x=26:y=26"),
  ].join(",");
  await promisify(execFile)("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", film,
    "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "36", "-preset", "veryslow",
    "-movflags", "+faststart", "-an", output]);
  console.log("Rendered " + output + " showing " + captions.command);
} finally {
  await rm(work, { recursive: true, force: true });
}
