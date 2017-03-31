const BitFieldMask = require("./bits.js").BitFieldMask;

var consts = {
	//Status register bits
	psr: {
		N_BIT: 31, //negative
		Z_BIT: 30, //zero
		C_BIT: 29, //carry
		V_BIT: 28, //overflow

		J_BIT: 24, //set jazelle (not used here)
		T_BIT: 5, //set thumb mode

		I_BIT: 7, //disable interrupts when set
		F_BIT: 6, //disable fiq when set

		M_FIELD: new BitFieldMask(0, 4)
	},

	//special register indices
	special_reg: {
		SP_REGISTER: 13,
		LINK_REGISTER: 14,
		PC_REGISTER: 15
	},

	//Processor mode
	proc_modes: {
		USR: 16,
		FIQ: 17,
		IRQ: 18,
		SVC: 19,
		ABT: 23,
		UND: 27,
		SYS: 31,
	},

	//Conditions
	conditions: {
		EQ: 0,
		NE: 1,

		CS: 2,
		CC: 3,

		MI: 4,
		PL: 5,

		VS: 6,
		VC: 7,

		HI: 8,
		LS: 9,

		GE: 10,
		LT: 11,

		GT: 12,
		LE: 13,

		AL: 14,
		NON_COND: 15
	}
}

var opcodes = {
	//Data-processing opcodes
	data_proc: {
		AND: 0,
		EOR: 1,
		SUB: 2,
		RSB: 3,
		ADD: 4,
		ADC: 5,
		SBC: 6,
		RSC: 7,
		TST: 8,
		TEQ: 9,
		CMP: 10,
		CMN: 11,
		ORR: 12,
		MOV: 13,
		BIC: 14,
		MVN: 15
	}
}

module.exports.consts = consts;
module.exports.opcodes = opcodes;