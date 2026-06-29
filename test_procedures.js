import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';

console.log(pythonGenerator.forBlock['procedures_defnoreturn'].toString());
console.log("----");
console.log(pythonGenerator.forBlock['procedures_callnoreturn'].toString());
