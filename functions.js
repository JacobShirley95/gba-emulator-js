const InstructionPattern = require("./instructions.js");
const BitUtils = require("./bits.js").BitUtils;
const BitFieldMask = require("./bits.js").BitFieldMask;

const Consts = require("./constants.js").consts;
const Conditions = Consts.conditions;
const PSR = Consts.psr;

const MAX_UINT_32 = BitUtils.createMask(32) >>> 0;
const MAX_INT_32 = BitUtils.createMask(31);

const BYTE_1_MASK = new BitFieldMask(0, 8);

const SHIFT_LSL = 0;
const SHIFT_LSR = 1;
const SHIFT_ASR = 2;
const SHIFT_ROR = 3;

function roru32(val, rotateBy) {
	return ror32(val, rotateBy) >>> 0;
}

function ror32(val, rotateBy) {
	var copy = (val & BitUtils.createMask(rotateBy)) >>> 0;
	var newVal = (val >> rotateBy) >>> 0;

	return newVal | (copy << (32 - rotateBy));
}

function getCarry(result) {
	return result > MAX_UINT_32 ? 1 : 0;
}

function getBorrow(result) {
	return result < -MAX_UINT_32 ? 1 : 0;
}

function getOverflow(result) {
	return result < -MAX_INT_32 || result > MAX_INT_32 ? 1 : 0;
}

function condPassed(cond, flags) {
	switch (cond) {
		case Conditions.EQ: 
			return BitUtils.isBitSet(PSR.N_BIT, flags);

		case Conditions.NE: 
			return !BitUtils.isBitSet(PSR.N_BIT, flags);

		case Conditions.CS: 
			return BitUtils.isBitSet(PSR.C_BIT, flags);

		case Conditions.CC: 
			return !BitUtils.isBitSet(PSR.C_BIT, flags);

		case Conditions.MI: 
			return BitUtils.isBitSet(PSR.N_BIT, flags);

		case Conditions.PL: 
			return !BitUtils.isBitSet(PSR.N_BIT, flags);

		case Conditions.VS: 
			return BitUtils.isBitSet(PSR.V_BIT, flags);

		case Conditions.VC: 
			return !BitUtils.isBitSet(PSR.V_BIT, flags);

		case Conditions.HI: 
			return BitUtils.isBitSet(PSR.C_BIT, flags) && !BitUtils.isBitSet(PSR.Z_BIT, flags);

		case Conditions.LS: 
			return !BitUtils.isBitSet(PSR.C_BIT, flags) || BitUtils.isBitSet(PSR.Z_BIT, flags);

		case Conditions.GE: 
			if (BitUtils.isBitSet(PSR.N_BIT, flags) && BitUtils.isBitSet(PSR.V_BIT, flags))
				return true;
			else if (!BitUtils.isBitSet(PSR.N_BIT, flags) && !BitUtils.isBitSet(PSR.V_BIT, flags))
			 	return true;
			else
			 	return false;

		case Conditions.LT: 
			if (BitUtils.isBitSet(PSR.N_BIT, flags) && !BitUtils.isBitSet(PSR.V_BIT, flags))
				return true;
			else if (!BitUtils.isBitSet(PSR.N_BIT, flags) && BitUtils.isBitSet(PSR.V_BIT, flags))
			 	return true;
			else
			 	return false;

		case Conditions.GT: 
			if (!BitUtils.isBitSet(PSR.Z_BIT, flags) && (BitUtils.isBitSet(PSR.N_BIT, flags) || BitUtils.isBitSet(PSR.V_BIT, flags)))
				return true;
			else if (!BitUtils.isBitSet(PSR.N_BIT, flags) && !BitUtils.isBitSet(PSR.V_BIT, flags))
			 	return true;
			else
			 	return false;

		case Conditions.LE: 
			if (BitUtils.isBitSet(PSR.Z_BIT, flags) || (BitUtils.isBitSet(PSR.N_BIT, flags) && !BitUtils.isBitSet(PSR.V_BIT, flags)))
				return true;
			else if (!BitUtils.isBitSet(PSR.N_BIT, flags) && BitUtils.isBitSet(PSR.V_BIT, flags))
			 	return true;
			else
			 	return false;

		case Conditions.AL: 
			return true;

		default: 
			return null;
	}
}

function getCFlag(cpu) {
	return cpu.getCPSR().bit(PSR.C_BIT);
}

function getAddress(cpu, o, condPass) {
	let addr = cpu.reg(o.Rn).val();
	let returnAddr = addr;

	if (!o.P && !o.W && !condPass) {
		return addr;
	}

	if (!o.I) {
		let offset_12 = o.addr_mode;
		if (o.U) {
			addr = addr + offset_12;
		} else {
			addr = addr - offset_12;
		}
	} else if (o.P) {
		let formatter = new InstructionPattern("[00000000]Rm(4)");
		let result = formatter.matches(o.addr_mode);
		if (result != null) {
			if (o.U) {
				addr = addr + cpu.reg(result.Rm).val();
			} else {
				addr = addr - cpu.reg(result.Rm).val();
			}
		} else {
			formatter = new InstructionPattern("shift_imm(5)shift(2)0Rm(4)");
			result = formatter.matches(o.addr_mode);
			if (result != null) {
				let index = 0;
				let Rm = cpu.reg(result.Rm).val();
				switch (result.shift) {
					case SHIFT_LSL:
						index = Rm << result.shift_imm;
						break;
					case SHIFT_LSR:
						if (result.shift_imm == 0) {
							index = 0;
						} else {
							index = Rm >>> result.shift_imm;
						}
						break;
					case SHIFT_ASR:
						if (result.shift_imm == 0) {
							if (BitUtils.getBit(31, Rm) == 1) {
								index = 0xFFFFFFFF;
							} else {
								index = 0;
							}
						} else {
							index = Rm >> result.shift_imm;
						}
						break;
					case SHIFT_ROR:
						if (result.shift_imm == 0) {
							index = (getCFlag(cpu) << 31) | (Rm >>> 1);
						} else {
							index = roru32(Rm, result.shift_imm);
						}
						break;
				}
				if (o.U) {
					addr = addr + index;
				} else {
					addr = addr - index;
				}
			}
		}
	}

	if (!o.P && !o.W && condPass)
		cpu.reg(o.Rn).val(addr);
	else if (o.P && o.W && condPass)
		cpu.reg(o.Rn).val(addr);

	return addr;
}

function getAddressMisc(cpu, o, condPass) {
	let addr = cpu.reg(o.Rn).val();
	let returnAddr = addr;

	if (o.I) { //immediate
		let formatter = new InstructionPattern("immedH(4)1111immedL(4)");
		let result = formatter.matches(o.addr_mode);

		let offset_8 = (result.immedH << 4) | result.immedL;
		if (o.U) {
			addr = addr + offset_8;
		} else {
			addr = addr - offset_8;
		}
	} else {

	}
}

function getShifterOperand(cpu, immediate, shifterCode) {
	if (immediate) {
		const IMM_PAT = new InstructionPattern("rotate_imm(4)immed_8(8)");
		let result = IMM_PAT.matches(shifterCode);

		let val = roru32(result.immed_8, result.rotate_imm * 2);
		if (result.rotate_imm == 0) {
			let cFlag = getCFlag(cpu);

			return {operand: val, carry: cFlag};
		} else {
			return {operand: val, carry: BitUtils.getBit(31, val)};
		}
	} else {
		if (BitUtils.getBit(4, shifterCode) == 0) {
			//immediate reg shift

			const IMM_REG_SHIFT = new InstructionPattern("shift_imm(5)shift(2)0Rm(4)");
			let result = IMM_REG_SHIFT.matches(shifterCode);

			let Rm = cpu.reg(result.Rm).val();

			let cFlag = getCFlag(cpu);

			//console.log(result);

			switch (result.shift) {
				case SHIFT_LSL: 
					if (result.shift_imm == 0) {
						return {operand: Rm, carry: cFlag};
					} else {
						let op = Rm << result.shift_imm;
						return {operand: op, carry: BitUtils.getBit(32 - result.shift_imm, Rm)};
					}
				case SHIFT_LSR:
					if (result.shift_imm == 0) {
						return {operand: 0, carry: BitUtils.getBit(31, Rm)};
					} else {
						let op = Rm >>> result.shift_imm;
						return {operand: op, carry: BitUtils.getBit(result.shift_imm - 1, Rm)};
					}
				case SHIFT_ASR:
					if (result.shift_imm == 0) {
						let lastBit = BitUtils.getBit(31, Rm);
						if (lastBit === 0) {
							return {operand: 0, carry: lastBit};
						} else {
							return {operand: 0xFFFFFFFF, carry: lastBit};
						}
					} else {
						let op = Rm >> result.shift_imm;
						return {operand: op, carry: BitUtils.getBit(result.shift_imm - 1, Rm)};
					}
				case SHIFT_ROR: 
					if (result.shift_imm !== 0) {
						return {operand: roru32(Rm, result.shift_imm), carry: BitUtils.getBit(result.shift_imm - 1, Rm)};
					} else {
						return {operand: (cFlag << 31) | (Rm >>> 1), carry: BitUtils.getBit(0, Rm)};
					}
			}
		} else if (BitUtils.getBit(7, shifterCode) == 0) {
			//reg shifts
			const REG_SHIFT = new InstructionPattern("Rs(4)0shift(2)1Rm(4)");
			let result = REG_SHIFT.matches(shifterCode);

			//console.log(result);

			let Rs = cpu.reg(result.Rs).val();
			let Rm = cpu.reg(result.Rm).val();

			let RsByte = BYTE_1_MASK.eval(Rs);

			let cFlag = getCFlag(cpu);

			switch (result.shift) {
				case SHIFT_LSL: 
					if (RsByte == 0) {
						return {operand: Rm, carry: cFlag};
					} else if (RsByte < 32) {
						let op = Rm << RsByte;
						return {operand: op, carry: BitUtils.getBit(32 - RsByte, Rm)};
					} else if (RsByte == 32) {
						return {operand: 0, carry: BitUtils.getBit(0, Rm)};
					} else {
						return {operand: 0, carry: 0};
					}

				case SHIFT_LSR:
					if (RsByte == 0) {
						return {operand: Rm, carry: cFlag};
					} else if (RsByte < 32) {
						let op = Rm >>> RsByte;
						return {operand: op, carry: BitUtils.getBit(RsByte - 1, Rm)};
					} else if (RsByte == 32) {
						return {operand: 0, carry: BitUtils.getBit(31, Rm)};
					} else {
						return {operand: 0, carry: 0};
					}
				case SHIFT_ASR: 
					if (RsByte == 0) {
						return {operand: Rm, carry: cFlag};
					} else if (RsByte < 32) {
						let op = Rm >> RsByte;
						return {operand: op, carry: BitUtils.getBit(RsByte - 1, Rm)};
					} else {
						let lastBit = BitUtils.getBit(31, Rm);
						if (lastBit === 0) {
							return {operand: 0, carry: lastBit};
						} else {
							return {operand: 0xFFFFFFFF, carry: lastBit};
						}
					}
				case SHIFT_ROR:
					if (RsByte == 0) {
						return {operand: Rm, carry: cFlag};
					} else if (RsByte < 32) {
						let op = Rm >> RsByte;
						return {operand: op, carry: BitUtils.getBit(RsByte - 1, Rm)};
					} else {
						let r = Rs & 0xF;
						if (r == 0) {
							return {operand: 0, carry: BitUtils.getBit(31, Rm)};
						} else {
							return {operand: roru32(Rm, r), carry: BitUtils.getBit(r - 1, Rm)};
						}
					}
			}

		} else {
			//console.log("error");
			//not a data-processing instr
			return null;
		}
	}
}

module.exports = class Functions {
	constructor() {

	}

	static ADC(cpu, o) {
		let cpsr = cpu.getCPSR();
		if (condPassed(o.cond, cpsr.val())) {
			let shifter_operand = getShifterOperand(cpu, o.I, o.shifter_operand);

			if (shifter_operand == null)
				return false;

			let Rd = cpu.reg(o.Rd);
			let Rn = cpu.reg(o.Rn);
			let result = Rn.val() + shifter_operand.operand + cpsr.bit(PSR.C_BIT);
			Rd.val(result);

			if (o.S && o.Rd === Consts.special_reg.PC_REGISTER) {
				if (cpu.currentModeHasSPSR())
					cpsr.setAs(cpu.getSPSR());
				else {
					console.log("Unpredictable");
				}
			} else if (o.S) {
				cpsr.bit(PSR.N_BIT, Rd.bit(31));
				cpsr.bit(PSR.Z_BIT, result === 0 ? 1 : 0);
				cpsr.bit(PSR.C_BIT, getCarry(result));
				cpsr.bit(PSR.V_BIT, getOverflow(result));
			}
		}

		return true;
	}

	static ADD(cpu, o) {
		let cpsr = cpu.getCPSR();
		if (condPassed(o.cond, cpsr.val())) {
			let shifter_operand = getShifterOperand(cpu, o.I, o.shifter_operand);

			if (shifter_operand == null)
				return false;

			let Rd = cpu.reg(o.Rd);
			let Rn = cpu.reg(o.Rn);
			let result = Rn.val() + shifter_operand.operand;
			Rd.val(result);

			if (o.S && o.Rd === Consts.special_reg.PC_REGISTER) {
				if (cpu.currentModeHasSPSR())
					cpsr.setAs(cpu.getSPSR());
				else {
					console.log("Unpredictable");
				}
			} else if (o.S) {
				cpsr.bit(PSR.N_BIT, Rd.bit(31));
				cpsr.bit(PSR.Z_BIT, result === 0 ? 1 : 0);
				cpsr.bit(PSR.C_BIT, getCarry(result));
				cpsr.bit(PSR.V_BIT, getOverflow(result));
			}
		}

		return true;
	}

	static AND(cpu, o) {
		let cpsr = cpu.getCPSR();
		if (condPassed(o.cond, cpsr.val())) {
			let shifter_operand = getShifterOperand(cpu, o.I, o.shifter_operand);

			if (shifter_operand == null)
				return false;

			let Rd = cpu.reg(o.Rd);
			let Rn = cpu.reg(o.Rn);
			let result = Rn.val() & shifter_operand.operand;
			Rd.val(result);

			if (o.S && o.Rd === Consts.special_reg.PC_REGISTER) {
				if (cpu.currentModeHasSPSR())
					cpsr.setAs(cpu.getSPSR());
				else {
					console.log("Unpredictable");
				}
			} else if (o.S) {
				cpsr.bit(PSR.N_BIT, Rd.bit(31));
				cpsr.bit(PSR.Z_BIT, result === 0 ? 1 : 0);
				cpsr.bit(PSR.C_BIT, shift_operand.carry);
				//cpsr.bit(PSR.V_BIT, getOverflow(result));
			}
		}

		return true;
	}

	static B(cpu, o) {
		if (condPassed(o.cond, cpu.getCPSR().val())) {
			if (o.L) {
				cpu.getLR().val(cpu.getNextAddress());
			}
			cpu.getPC().add(BitUtils.signExtend(o.signed_immed_24, 24, 30) << 2);
		}

		return true;
	}

	static BX(cpu, o) {
		let cpsr = cpu.getCPSR();
		if (condPassed(o.cond, cpsr.val())) {
			let Rm = cpu.reg(o.Rm);
			cpsr.bit(PSR.T_BIT, Rm.bit(0));
			cpu.getPC().val(Rm.val() & 0xFFFFFFFE);
		}

		return true;
	}

	static BIC(cpu, o) {
		let cpsr = cpu.getCPSR();
		if (condPassed(o.cond, cpsr.val())) {
			let shifter_operand = getShifterOperand(cpu, o.I, o.shifter_operand);

			if (shifter_operand == null)
				return false;

			let Rd = cpu.reg(o.Rd);
			let Rn = cpu.reg(o.Rn);
			let result = Rn.val() & ~(shifter_operand.operand);
			Rd.val(result);

			if (o.S && o.Rd === Consts.special_reg.PC_REGISTER) {
				if (cpu.currentModeHasSPSR())
					cpsr.setAs(cpu.getSPSR());
				else {
					console.log("Unpredictable");
				}
			} else if (o.S) {
				cpsr.bit(PSR.N_BIT, Rd.bit(31));
				cpsr.bit(PSR.Z_BIT, result === 0 ? 1 : 0);
				cpsr.bit(PSR.C_BIT, shift_operand.carry);
				//cpsr.bit(PSR.V_BIT, getOverflow(result));
			}
		}

		return true;
	}

	static CDP(cpu, o) {
		//I don't think this is implemented... maybe in some games
	}

	static MISC_STUFF() {
		
	}

	static LDR(cpu, o) {
		let cpsr = cpu.getCPSR();
		let passed = condPassed(o.cond, cpsr.val());
		if (passed) {
			let address = getAddress(cpu, o, passed);

			console.log(address);
		}

		return true;
	}
}