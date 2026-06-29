const code = `
def vai():
  global item
  item = (item if isinstance(item, Number) else 0) + 1


for count in range(1):
  vai()
`;
let newCode = code;
const defs = newCode.match(/^def ([a-zA-Z0-9_]+)\(/gm);
if (defs) {
  const funcNames = defs.map(d => d.replace('def ', '').replace('(', '').trim());
  newCode = newCode.replace(/^def /gm, 'async def ');
  funcNames.forEach(name => {
    const regex = new RegExp(`(?<!def\\s)(?<!async\\sdef\\s)(?<!\\.)\\b${name}\\(`, 'g');
    newCode = newCode.replace(regex, `await ${name}(`);
  });
}
console.log(newCode);
