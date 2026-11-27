const section = document.querySelector("[data-text-request]");
const form = section.querySelector("form");
const field = form.elements.mobile;
const group = field.closest(".govuk-form-group");
const button = form.querySelector("button");

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text ?? "";
  return node;
}

function clearError() {
  section.querySelector(".govuk-error-summary")?.remove();
  group.querySelector(".govuk-error-message")?.remove();
  group.classList.remove("govuk-form-group--error");
  field.classList.remove("govuk-input--error");
  field.setAttribute("aria-describedby", "mobile-hint");
}

function showError(message, inField) {
  const summary = element("div", "govuk-error-summary");
  summary.tabIndex = -1;
  const alert = element("div");
  alert.setAttribute("role", "alert");
  const body = element("div", "govuk-error-summary__body");
  if (inField) {
    const list = element("ul", "govuk-list govuk-error-summary__list");
    const link = element("a", "", message);
    link.href = "#mobile";
    list.append(element("li"));
    list.firstChild.append(link);
    body.append(list);
    const inline = element("p", "govuk-error-message", message);
    inline.id = "mobile-error";
    inline.prepend(element("span", "govuk-visually-hidden", "Error: "));
    field.before(inline);
    group.classList.add("govuk-form-group--error");
    field.classList.add("govuk-input--error");
    field.setAttribute("aria-describedby", "mobile-hint mobile-error");
  } else {
    body.append(element("p", "govuk-body", message));
  }
  alert.append(element("h2", "govuk-error-summary__title", "There is a problem"), body);
  summary.append(alert);
  form.before(summary);
  summary.focus();
}

function showRequested({ message, preview }) {
  const done = element("div", "text-requested");
  done.tabIndex = -1;
  done.setAttribute("role", "status");
  done.append(element("h3", "govuk-heading-s", "Text requested"));
  if (preview) {
    done.append(element("p", "govuk-body", "We cannot send texts at present. This is the text you would have received."),
      element("p", "text-preview", preview));
  } else {
    done.append(element("p", "govuk-body", "We have sent one text to the number you gave."), element("p", "govuk-body", message));
  }
  form.replaceWith(done);
  done.focus();
}

form.hidden = false;
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (button.disabled) return;
  clearError();
  button.disabled = true;
  try {
    const response = await fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)) });
    const reply = await response.json();
    if (reply.status === "requested") showRequested(reply);
    else showError(reply.message, reply.field === "mobile");
  } catch {
    showError("We could not reach the archive. Check your connection and try again.");
  } finally {
    button.disabled = false;
  }
});
