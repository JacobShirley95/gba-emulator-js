var Functions = require("./functions.js");
var InstructionPattern = require("./instructions.js");
var BitUtils = require("./bits.js").BitUtils;
var Consts = require("./constants.js").consts;
var Opcodes = require("./constants.js").opcodes;

const fs = require("fs");

var instrs = [];

function createInstruction(name, func, pattern) {
	instrs.push({name, func, pattern: new InstructionPattern(pattern)});
}

function loadInstructions() {
	//Add with carry

	var instr = "10000000101110000100001001110010";

	createInstruction("ADC", Functions.ADC, "cond(4)[00I0101S]Rn(4)Rd(4)shifter_operand(12)"); //done
	createInstruction("ADD", Functions.ADD, "cond(4)[00I0100S]Rn(4)Rd(4)shifter_operand(12)"); //done
	createInstruction("AND", Functions.AND, "cond(4)[00I0000S]Rn(4)Rd(4)shifter_operand(12)"); //done

	createInstruction("B", Functions.B, "cond(4)[101L]signed_immed_24(24)"); //done
	createInstruction("BX", Functions.BX, "cond(4)[00010010][1111][1111][1111][1111][0001]Rm(4)"); //done

	createInstruction("CDP", Functions.CDP, "cond(4)[1110]opcode_1(4)CRn(4)CRd(4)cp_num(4)opcode_2(3)[0]CRm(4)");

	createInstruction("LDC", Functions.LDC, "cond(4)[110PUNW1]Rn(4)CRd(4)cp_num(4)_8_bit_word_offset(8)");

	createInstruction("LDR", Functions.LDR, "cond(4)[01IPU0W1]Rn(4)Rd(4)addr_mode(12)");
	//let fields = instrs[0].pattern.matches(BitUtils.binToDen(instr));
	//instrs[0].func(cpu, fields);
}

class Register {
	constructor(physicalRegisters) {
		this.cpu = cpu;
		this.index = 0;
		this.pR = [];

		for (var i = 0; i < physicalRegisters; i++) {
			this.pR.push(0);
		}
	}

	setIndex(index) {
		this.index = index;
	}

	setAs(reg) {
		return this.val(reg.val());
	}

	copy(index) {
		this.pR[this.index] = this.pR[index];
	}

	add(val) {
		this.pR[this.index] += val;
	}

	val(v) {
		if (typeof v !== 'undefined') {
			this.pR[this.index] = v;
			return v;
		}

		return this.pR[this.index];
	}

	bit(bit, val) {
		if (typeof val !== 'undefined') {
			val = BitUtils.setBit(bit, val, this.pR[this.index]);
			this.pR[this.index] = val;
			return val;
		}

		return (this.pR[this.index] >> bit) & 1;
	}

	field(fieldMask, data) {
		if (typeof data !== 'undefined') {
			this.pR[this.index] = fieldMask.replaceBits(this.pR[this.index], data);
		}

		return fieldMask.eval(this.pR[this.index]);
	}
}

function getRegisterIndex(reg, mode) {
	let proc_modes = Consts.proc_modes;
	switch (mode) {
		case proc_modes.USR:
		case proc_modes.SYS:
			return 0;

		case proc_modes.FIQ: 
			if (reg < 8)
				return 0;
			else if (reg < 13)
				return 1;
			else if (reg < 15)
				return 5;
			else if (reg < 17)
				return 0;
			else 
				return 4;

		case proc_modes.IRQ: 
			if (reg < 13)
				return 0;
			else if (reg < 15)
				return 4;
			else if (reg < 17)
				return 0;
			else 
				return 3;

		case proc_modes.UND:
			if (reg < 13)
				return 0;
			else if (reg < 15)
				return 3;
			else if (reg < 17)
				return 0;
			else 
				return 2; 

		case proc_modes.ABT: 
			if (reg < 13)
				return 0;
			else if (reg < 15)
				return 2;
			else if (reg < 17)
				return 0;
			else 
				return 1; 

		case proc_modes.SVC:
			if (reg < 13)
				return 0;
			else if (reg < 15)
				return 1;
			else if (reg < 17)
				return 0;
			else 
				return 0; 
	}
}

class ArmCPU {
	constructor() {
		this.mode = 0;
		this.instrAddr = 0;
		this._registers = [];
		this.tMode = false;

		//R0 - R7 unbanked
		for (var i = 0; i < 8; i++) {
			this._registers.push(new Register(1));
		}

		//R8 - R12 banked(2)
		for (var i = 0; i < 5; i++) {
			this._registers.push(new Register(2));
		}

		//R13 - R14 banked(6)
		for (var i = 0; i < 2; i++) {
			this._registers.push(new Register(6));
		}

		//R15 - PC
		this._registers.push(new Register(1));

		//CPSR register
		this._registers.push(new Register(1));

		//SPSR registers
		this._registers.push(new Register(5));
	}

	getMode() {
		return this.mode;
	}

	setMode(mode) {
		this.getCPSR().field(Consts.psr.M_FIELD, mode);
		this.mode = mode;

		for (var i = 0; i < this._registers.length; i++) {
			if (i === 17 && !this.currentModeHasSPSR()) {
				continue;
			}

			this._registers[i].setIndex(getRegisterIndex(i, this.mode));
		}
	}

	reg(index) {
		return this._registers[index];
	}

	getLR() {
		return this.reg(Consts.special_reg.LINK_REGISTER);
	}

	getPC() {
		return this.reg(Consts.special_reg.PC_REGISTER);
	}

	getCurrentAddress() {
		return this.instrAddr;
	}

	getNextAddress() {
		return this.getCurrentAddress() + 1;
	}

	getCPSR() {
		return this.reg(16);
	}

	getSPSR() {
		return this.reg(17);
	}

	currentModeHasSPSR() {
		return this.mode !== Consts.proc_modes.USR && this.mode !== Consts.proc_modes.SYS;
	}

	tick() {

	}
}

var cpu = new ArmCPU();
cpu.setMode(Consts.proc_modes.SYS);
//console.log(Consts.psr.M_FIELD.replaceBits(2, 5));

var functions = new Functions(cpu);
loadInstructions();

var romStream = fs.createReadStream("rom.gba");
var data = null;
var c = 0;

romStream.on('readable', () => {
	while ((data = romStream.read(4)) != null) {
		c++;
		let i = data.readUInt32LE();
		let instr = instrs[6];
		var match = instr.pattern.matches(i);
		if (match != null) {
			console.log(match);
			//instr.func(cpu, match);
			//break;
			//console.log(match);
		}

		//break;
	}
});//*/