import { RecordOffice } from "./record-office.js";

export { RequestLedger } from "./request-ledger.js";

export default {
  fetch: (request, env) => new RecordOffice(env).fetch(request),
};
