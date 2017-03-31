//001(I010S)Rn(3)Rd(4)shifter_operand(7)

const BitUtils = require("./bits.js").BitUtils;
const BitFieldMask = require("./bits.js").BitFieldMask;

const DECODE_PATTERN = /\[([^\]]+)\]/g;
const FIELD_PATTERN = /([^\[^\]^\)^0^1]+)\((\d+)\)/g;

function replaceAt(string, index, replace) {
  return string.substring(0, index) + replace + string.substring(index + 1);
}

module.exports = class InstructionPattern {
	constructor(pattern) {
		this.decodePatterns = [];
		this.fields = {};

		var stuff = [];
		let m = [];

		while ((m = DECODE_PATTERN.exec(pattern)) !== null) {
		    if (m.index === DECODE_PATTERN.lastIndex) {
		        DECODE_PATTERN.lastIndex++;
		    }

		    var decodeStr = m[1];
		    stuff.push({decode: true, decodeStr: m[1], totalLen: m[0].length, id: m.index});
		}

		while ((m = FIELD_PATTERN.exec(pattern)) !== null) {
		    if (m.index === FIELD_PATTERN.lastIndex) {
		        FIELD_PATTERN.lastIndex++;
		    }

		    stuff.push({decode: false, fieldName: m[1], fieldLen: parseInt(m[2]), totalLen: m[0].length, id: m.index});
		}

		let posMod = 0;
		let len = pattern.length;

		stuff.sort(function (a, b) {
			return b.id - a.id;
		});

		for (let i = 0; i < stuff.length; i++) {
			let st = stuff[i];
			let pos = len - st.id - st.totalLen + posMod;

			if (st.decode) {
				posMod += -2;
				
				this.decodePatterns.push(new DecodePattern(st.decodeStr, pos));
			} else {
				posMod += st.fieldLen - st.totalLen;

				this.fields[st.fieldName] = new BitFieldMask(pos, st.fieldLen);
			}
		}
	}

	matches(code) {
		var matches = [];
		for (var dP of this.decodePatterns) {
			var m = dP.matches(code);
			if (m)
				matches.push(m);
		}

		if (matches.length === this.decodePatterns.length) {
			var obj = {};
			for (var m of matches) {
				for (var f in m.decode) {
					obj[f] = m.decode[f];
				}
			}

			for (var m in this.fields) {
				obj[m] = this.fields[m].eval(code);
			}
			return obj;
		}

		return null;
	}
}

class DecodePattern extends BitFieldMask {
	constructor(pattern, startPos) {
		super(startPos, pattern.length);

		this.options = [];
		this.len = pattern.length;

		var defs = [];
		var len = pattern.length - 1;

		for (var i = 0; i < pattern.length; i++) {
			var c = pattern[i];
			if (c != '0' && c != '1') {
				defs.push({c, pos: i});
			}
		}

		for (var i = 0; i < BitUtils.createMask(defs.length) + 1; i++) {
			var newStr = pattern + "";
			
			var option = {val: 0, decode: {}};

			for (var j = 0; j < defs.length; j++) {
				var set = (i >> j) & 1;
				if (set) {
					option.decode[defs[j].c] = true;
				}
				newStr = replaceAt(newStr, defs[j].pos, set);
			}

			option.val = BitUtils.binToDen(newStr);

			this.options.push(option);
		}
	}

	matches(code) {
		var cmp = this.eval(code);

		for (var option of this.options) {
			if (cmp === option.val) {
				return option;
			}
		}

		return null;
	}
}