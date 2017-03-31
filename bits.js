class BitUtils {
	static binToDen(binStr) {
		var result = 0;
		var len = binStr.length - 1;
		for (var i = 0; i < binStr.length; i++) {
			result |= (binStr[i] == '1' ? 1 : 0) << (len - i);
		}
		return result;
	}

	static bitToStr(b) {
		return b == 1 ? "1" : "0";
	}

	static createMask(len) {
		var result = 0;
		for (var i = 0; i < len; i++) {
			result |= 1 << i;
		}
		return result;
	}

	static setBit(index, val, data) {
		if (val === 0) {
			return BitUtils.turnOff(index, 1, data);
		} else {
			return BitUtils.turnOn(index, 1, data);
		}
	}

	static turnOff(index, data, target) {
		return target & ~(data << index);
	}

	static turnOn(index, data, target) {
		return target | (data << index);
	}

	static getBit(index, data) {
		return (data >> index) & 1;
	}

	static isBitSet(index, data) {
		return BitUtils.getBit(index, data) === 1;
	}

	static countSetBits(data) {
		let c = 0;
		for (var i = 0; i < 32; i++)
			if (BitUtils.isBitSet(i, data))
				c++;
		return c;
	}

	static signExtend(data, startPos, endPos) {
		let sign = (data >> startPos) & 1;
		if (sign === 0)
			return data;

		return data | (BitUtils.createMask(endPos - startPos) << (startPos + 1));
	}
}

class BitFieldMask {
	constructor(pos, len) {
		this.pos = pos;
		this.mask = BitUtils.createMask(len);
		this.clearMask = ~(this.mask << this.pos);
	}

	eval(data) {
		return (data >> this.pos) & this.mask;
	}

	replaceBits(target, data) {
		return (target & this.clearMask) | (data << this.pos);
	}

	equals(data) {
		return get(data) === this.mask;
	}
}

module.exports.BitUtils = BitUtils;
module.exports.BitFieldMask = BitFieldMask;