export const videoReference = "AV/98/019";
export const settingsPath = "/settings.json";

function setting(value, pattern, remedy) {
  if (!pattern.test(value)) throw Error(remedy);
  return value;
}

// The build stamps these into the pages and publishes them for the Worker, so the film,
// its transcript and the ticket agree on one address.
export function officeSettings(env = process.env) {
  const port = Number(setting(env.BOARD_PORT || "2222", /^[1-9]\d{0,4}$/, "Set BOARD_PORT to the board’s port number, such as 2222."));
  if (port > 65535) throw Error("Set BOARD_PORT to a port number below 65536.");
  return {
    board: {
      host: setting(env.BOARD_HOST || "board.example", /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i,
        "Set BOARD_HOST to the board’s host name, such as board.example."),
      port,
      user: setting(env.BOARD_USER || "reader", /^[a-z_][a-z0-9_-]{0,31}$/,
        "Set BOARD_USER to the lower-case SSH username shown in the film, such as reader."),
    },
    sender: setting(env.SMS_SENDER_NAME || "Record Office", /^[\w .&'-]{1,30}$/,
      "Set SMS_SENDER_NAME to the name the text opens with, in 30 characters or fewer."),
    number: setting(env.SMS_NUMBER || "+447460039666", /^\+[1-9]\d{7,14}$/,
      "Set SMS_NUMBER to the number that answers texts, with its country code, such as +447700900982."),
  };
}

// The number as someone would write it on a label: a UK mobile in its national form.
export function writtenNumber(number) {
  const mobile = /^\+44(7\d{3})(\d{6})$/.exec(number);
  return mobile ? `0${mobile[1]} ${mobile[2]}` : number;
}

export function boardCommand({ host, port, user }) {
  return port === 22 ? `ssh ${user}@${host}` : `ssh -p ${port} ${user}@${host}`;
}

export async function publishedSettings(assets) {
  const response = await assets.fetch(new URL(settingsPath, "https://assets.local"));
  if (!response.ok) throw Error("Run npm run build:archive so the archive publishes settings.json.");
  return response.json();
}
