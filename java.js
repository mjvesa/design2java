/**
 *  Converts inermediate representation into Java
 */
import flowImports from "./flow_imports.js";

const kebabToPascalCase = str => {
  const parts = str.split("-");
  let result = "";
  for (const i in parts) {
    result = result.concat(parts[i][0].toUpperCase() + parts[i].slice(1));
  }
  return result;
};

const kebabToCamelCase = str => {
  const pascal = kebabToPascalCase(str).replace("/Vaadin/g", "");
  return pascal.charAt(0).toLowerCase() + pascal.substring(1);
};

const classForTag = tag => {
  return flowImports[tag] ? flowImports[tag].name : kebabToPascalCase(tag);
};

export const modelToJava = (pascalCaseName, tag, packageName, code) => {
  const singleIndent = "    ";
  const doubleIndent = singleIndent + singleIndent;
  const importedTags = new Set();
  let internalClasses = "";
  const stack = [];
  const tree = [];
  const variableStack = [];
  const varNames = {};
  let fields = "";

  let variableCount = 0;

  let current = document.createElement("div");
  let currentTag = "";
  let currentVar = "this";
  let currentVarDefinition = "";

  importedTags.add("div");

  let result = "";
  code.forEach(str => {
    const trimmed = str.trim();
    switch (trimmed) {
      case "(": {
        currentTag = stack.pop();
        const elementClass = classForTag(currentTag);

        //Create an element in the DOM
        const old = current;
        tree.push(current);
        current = document.createElement(currentTag);
        old.appendChild(current);

        const varName = kebabToCamelCase(elementClass);
        let varCount = varNames[varName] || 0;
        varCount++;
        varNames[varName] = varCount;
        const newVar = varName + (varCount === 1 ? "" : varCount);
        variableCount++;

        if (currentTag === "unide-grid") {
          currentVarDefinition = `${elementClass}<${pascalCaseName}GridType> ${newVar}`;
          result +=
            `${doubleIndent}${currentVarDefinition} = new ${elementClass}<>();\n` +
            `${doubleIndent}${currentVar}.add(${newVar});\n`;
        } else {
          currentVarDefinition = `${elementClass} ${newVar}`;
          result +=
            `${doubleIndent}${currentVarDefinition} = new ${elementClass}();\n` +
            `${doubleIndent}${currentVar}.add(${newVar});\n`;
        }
        variableStack.push(currentVar);
        currentVar = newVar;

        if (currentTag in flowImports) {
          importedTags.add(currentTag);
        }
        break;
      }
      case ")":
        current = tree.pop();
        currentVar = variableStack.pop();
        break;
      case "=": {
        const tos = stack.pop();
        const nos = stack.pop();
        if (!nos || !tos) {
          return;
        }

        if (currentTag === "unide-grid") {
          if (nos === "items") {
            const obj = JSON.parse(tos);
            let gridItems =
              `${doubleIndent}ArrayList<${pascalCaseName}GridType> items = new ArrayList<>();\n` +
              `${doubleIndent}${pascalCaseName}GridType item;\n`;
            obj.forEach(values => {
              let item = `${doubleIndent}item = new ${pascalCaseName}GridType();\n`;
              Object.keys(values).forEach(key => {
                item = item.concat(
                  `${doubleIndent}item.set${key}("${values[key]}");\n`
                );
              });
              item = item.concat(`${doubleIndent}items.add(item);\n`);
              gridItems = gridItems.concat(item);
            });
            result = result
              .concat(gridItems)
              .concat(`${doubleIndent}${currentVar}.setItems(items);\n`);
            return;
          } else if (nos === "columnCaptions") {
            const obj = JSON.parse(tos);
            let methods = "";
            let fields = "";
            let creation = "";
            obj.forEach(pair => {
              creation = creation.concat(
                `${doubleIndent}${currentVar}.addColumn(${pascalCaseName}GridType::get${pair.path}).setHeader("${pair.name}");\n`
              );
              fields = fields.concat(`private String ${pair.path};\n`);
              methods = methods.concat(`public String get${pair.path}() {
                  return this.${pair.path};
              }
              public void set${pair.path}(String value) {
                this.${pair.path}=value;
              }
                `);
            });

            internalClasses =
              internalClasses +
              `${singleIndent}public static class ${pascalCaseName}GridType {
              ${fields}
              ${methods}
            }`;
            result = result.concat(creation);
            return;
          }
        }

        if (nos === "targetRoute") {
          result = result.concat(
            `${doubleIndent}${currentVar}.getElement().addEventListener("click", e-> {\n` +
              `${doubleIndent}${singleIndent}${currentVar}.getUI().ifPresent(ui -> ui.navigate("${kebabToPascalCase(
                tos
              )}"))\n;` +
              `${doubleIndent}});`
          );
        } else if (nos === "fieldName") {
          const fieldName = tos;
          result = result.replace(currentVarDefinition, fieldName);
          const re = new RegExp(currentVar, "g");
          result = result.replace(re, fieldName);
          fields =
            fields +
            `${singleIndent}${
              currentVarDefinition.split(" ")[0]
            } ${fieldName};\n`;
          currentVar = fieldName;
        } else if (nos in current) {
          try {
            JSON.parse(tos);
            if (nos === "textContent") {
              result = result.concat(
                `        ${currentVar}.getElement().setText("${tos}");\n`
              );
            } else {
              result = result.concat(
                `${doubleIndent}${currentVar}.getElement().setProperty("${nos}","${tos.replace(
                  /"/g,
                  "'"
                )}");\n`
              );
            }
          } catch (e) {
            if (nos === "textContent") {
              result = result.concat(
                `${doubleIndent}${currentVar}.getElement().setText("${tos.replace(
                  /"/g,
                  '\\"'
                )}");\n`
              );
            } else {
              result = result.concat(
                `${doubleIndent}${currentVar}.getElement().setProperty("${nos}","${tos}");\n`
              );
            }
          }
        } else {
          result = result.concat(
            `${doubleIndent}${currentVar}.getElement().setAttribute("${nos}","${tos}");\n`
          );
        }
        break;
      }
      default:
        stack.push(trimmed);
    }
  });

  let importStrings = "";

  importedTags.forEach(tag => {
    importStrings = importStrings.concat(`${flowImports[tag].import}\n`);
  });

  return `package ${packageName};
${importStrings}
import com.vaadin.flow.router.Route;
@Route("${pascalCaseName}")
public class ${pascalCaseName} extends Div {
      ${fields}
      ${internalClasses}
      public ${pascalCaseName}() {
${result}
      }
    }
  `;
};

