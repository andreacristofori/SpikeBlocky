const code = `
def vai():
  await _drive_pair_for_degrees(90, 0, 50)

for count in range(1):
  vai()
`;
let newCode = code;
const defs = newCode.match(/^def ([a-zA-Z0-9_]+)\(/gm);
if (defs) {
  const funcNames = defs.map(d => d.replace('def ', '').replace('(', '').trim());
  newCode = newCode.replace(/^def /gm, 'async def ');
  funcNames.forEach(name => {
    const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
    newCode = newCode.replace(regex, (match, offset, string) => {
      const textBefore = string.substring(0, offset);
      if (textBefore.endsWith('def ') || textBefore.endsWith('async def ') || textBefore.endsWith('.')) {
        return match;
      }
      return `await ${match}`;
    });
  });
}
console.log(newCode);
