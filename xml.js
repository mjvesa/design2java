export const XMLToATIR = html => {
  const parser = new DOMParser();
  const document = parser.parseFromString(
    "<div>" + html + "</div>",
    "text/xml"
  );
  const atir = [];

  const parseTree = parent => {
    for (let el of parent.childNodes) {
      if (el.nodeType === 3) {
        if (/\S/.test(el.textContent)) {
          atir.push("textContent");
          atir.push(el.textContent);
          atir.push("=");
        }
      } else {
        atir.push(el.tagName.toLowerCase());
        atir.push("(");
        const attributes = el.attributes;
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes.item(i);
          atir.push(attr.name);
          atir.push(attr.value);
          atir.push("=");
        }

        if (el.children) {
          parseTree(el);
        }
        atir.push(")");
      }
    }
  };
  parseTree(document);

  return atir.slice(2, atir.length - 1);
};
