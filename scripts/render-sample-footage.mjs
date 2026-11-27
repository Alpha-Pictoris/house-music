import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { boardCommand, officeSettings, videoReference } from "../archive-worker/office-settings.js";

// Renders the stand-in film for AV/98/019 with the board address from BOARD_HOST, BOARD_PORT
// and BOARD_USER. Needs ffmpeg with drawtext. The real footage replaces this file.
const output = fileURLToPath(new URL("../archive/assets/riggers-yard-sample.mp4", import.meta.url));
const frame = "s=640x480:r=25";
const captions = {
  sample: `SAMPLE FOOTAGE\n${videoReference}\nViewing copy to follow`,
  command: boardCommand(officeSettings().board),
  stamp: "12 NOV 1998  21:47",
};

const work = await mkdtemp(join(tmpdir(), "sample-footage-"));
try {
  const text = {};
  for (const [name, caption] of Object.entries(captions)) {
    text[name] = join(work, name + ".txt");
    await writeFile(text[name], caption);
  }
  const type = (file, style) => `drawtext=textfile=${file}:font=monospace:${style}`;
  const filters = [
    `smptebars=${frame}:d=3,drawbox=y=150:h=180:color=black@0.8:t=fill,`
      + type(text.sample, "fontsize=30:fontcolor=white:line_spacing=14:x=(w-text_w)/2:y=(h-text_h)/2") + "[bars]",
    `color=c=0x06120c:${frame}:d=5,noise=alls=10:allf=t,`
      + type(text.command, "fontsize=26:fontcolor=0x5dff8f:x=(w-text_w)/2:y=(h-text_h)/2") + ","
      + type(text.stamp, "fontsize=20:fontcolor=0xffd9a0:x=w-text_w-28:y=h-text_h-28") + "[screen]",
    "[bars][screen]concat=n=2:v=1[film]",
  ];
  await promisify(execFile)("ffmpeg", ["-y", "-loglevel", "error", "-filter_complex", filters.join(";"), "-map", "[film]",
    "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "32", "-preset", "veryslow",
    "-movflags", "+faststart", "-an", output]);
  console.log("Rendered " + output + " showing " + captions.command);
} finally {
  await rm(work, { recursive: true, force: true });
}
