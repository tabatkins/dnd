class RollContext {
	/*
	A class to track information about rolls to ensure all rolls halt eventually.
	To use this class, pass an instance to the constructor of Roller.
	*/

	constructor(max_rolls=1000) {
		this.max_rolls = max_rolls
		this.rolls = 0
		this.reset()
	}

	reset() {
		// Called at the start of each new roll.
		this.rolls = 0
	}

	count_roll(n=1) {
		/*
		Called each time a die is about to be rolled.
		:param int n: The number of rolls about to be made.
		:raises d20.TooManyRolls: if the roller should stop rolling dice because too many have been rolled.
		*/
		this.rolls += n
		if(this.rolls > this.max_rolls) {
			throw Exception("Too many dice rolled.");
		}
	}
}

export class RollResult {
	// Holds information about the result of a roll. This should generally not be constructed manually.

	constructor(the_ast, the_roll, stringifier) {
		/*
		:type the_ast: ast.Node
		:type the_roll: d20.Expression
		:type stringifier: d20.Stringifier
		*/
		this.ast = the_ast
		this.expr = the_roll
		this.stringifier = stringifier
		this.comment = the_roll.comment
	}

	get total() {
		return Math.floor(this.expr.total);
	}

	get result() {
		return this.stringifier.stringify(this.expr)
	}

	get crit() {
		/*
		If the leftmost node was Xd20kh1, returns "crit" if the roll was a 20 and
		"fail" if the roll was a 1.
		Returns "none" otherwise.
		*/
		// find the left most node in the dice expression
		left = self.expr
		while(left.children) {
			left = left.children[0]
		}

		// ensure the node is dice
		if(!left instanceof Dice) {
			return CritType.NONE
		}

		// ensure only one die of size 20 is kept
		if(!(left.keptset.length == 1 && left.size == 20)){
			return CritType.NONE
		}

		if(left.total == 1) {
			return CritType.FAIL
		} else if(left.total == 20) {
			return CritType.CRIT
		} else {
			return CritType.NONE
		}
	}

	toString() {
		return this.result
	}

	valueOf() {
		return this.total
	}
}


export class Roller {
	// The main class responsible for parsing dice into an AST and evaluating that AST.

	constructor(context = new RollContext()) {
		this.context = context
	}

	roll(	 expr,
			 stringifier = new MarkdownStringifier(),
			 advantage = "none") {
		/*
		Rolls the dice.

		:param expr: The dice to roll.
		:type expr: str or ast.Node
		:param stringifier: The stringifier to stringify the result. Defaults to MarkdownStringifier.
		:type stringifier: d20.Stringifier
		:param bool allow_comments: Whether to parse for comments after the main roll expression (potential slowdown)
		:param AdvType advantage: If the roll should be made at advantage. Only applies if the leftmost node is 1d20.
		:rtype: RollResult
		*/
		this.context.reset()

		if(typeof expr == "string") {
			var dice_tree = this.parse(expr)
		} else {
			dice_tree = expr
		}

		// TODO: handle adv/dis somehow

		return new RollResult(dice_tree, dice_expr, stringifier)
	}

	static parse(str) {
		var [result, i] = parseCommentedExpr(str, 0);
		if(!result) throw new SyntaxError(`Couldn't parse dice expression '${str}'.`);
		return result;
	}
}

export function parseCommentedExpr(str, start) {
	var [dice, i] = parseCompList(str, start);
	if(!dice) return Result.no(start);
	var [_, i] = parseWS(str, i);
	var comment = str.slice(i);
	if(comment) return Result.yes(new CommentedExpr(dice, comment), str.length-1);
	return Result.yes(dice, i);
}
export function parseCompList(str, start) {
	var results = [];
	var [expr, i] = parseMathList(str, start);
	if(!expr) return Result.no(start);
	results.push(expr);
	while(true) {
		var [expr, i] = parseSeq(
			parseOptional(parseWS),
			parseRegex(/^(==|>=|<=|!=|<|>)/),
			parseOptional(parseWS),
			parseMathList,
			)(str, i)
			.map(x=>x[3])
		if(!expr) break;
		results.push(op, expr);
	}
	var {i} = parseWS(str, i);
	var ret = results.length == 1 ? results[0] : new CompList(results);
	return Result.yes(ret, i);
}
export function parseMathList(str, start) {
	var results = [];
	var [expr, i] = parseUnaryOp(str, start);
	if(!expr) return Result.no(start);
	results.push(expr);
	while(true) {
		var [expr, i] = parseSeq(
			parseOptional(parseWS),
			parseRegex(/^(\+|-|\*|\/|\/\/|%)/),
			parseOptional(parseWS),
			parseUnaryOp,
			)(str, i)
			.map(x=>x[3])
		if(!expr) break;
		results.push(op, expr);
	}
	var [_, i] = parseWS(str, i);
	var ret = results.length == 1 ? results[0] : new MathList(results);
	return Result.yes(ret, i);
}
export function parseUnaryOp(str, start) {
	var [signs, i] = parseRegex(/^[+-]+/)(str, start);
	var [atom, i] = parseAtom(str, i);
	if(!atom) return Result.no(start);
	if(!signs) return Result.yes(atom, i);
	var numMinuses = (signs.match(/-/g) || []).length;
	if(numMinuses % 2 == 0) return Result.yes(atom, i);
	return Result.yes(new UnaryMinus(atom), i);
}
export function parseAtom(str, start) {
	var i = start;
	var [result, i] = parseEither(
		parseDice,
		parseSet,
		parseLiteral,
		)(str, i);
	if(!result) return Result.no(start);
	var [_, i] = parseWS(str, i);
	var [anno, i] = parseAnno(str, i);
	if(anno) result.anno = anno;
	return Result.yes(result, i);
}
export function parseWS(str, start) {
	return parseRegex(/^\s+/)(str, start);
}
export function parseDice(str, start) {
	// diceexpr
	var [int, i] = parseInteger(str, start);
	if(int === null) int = 1;
	var [d, i] = parseStr("d")(str, i);
	if(!d) return Result.no(start);
	var [value, i] = parseEither(
		parseInteger,
		parseStr("%"),
	)(str, i);
	if(!value) return Result.no(start);
	var [ops, i] = parseStar(parseDiceOp)(str, i);
	return Result.yes(new DiceVal(+int, +value, ops));
}
export function parseDiceOp(str, start) {
	return parseRegex(/^(k|p|rr|ro|ra|e|mi|ma)(l|h|<|>)?(\d+)/)(str, start)
		.map(x=>new DiceOp(...match.slice(1)));
}
export function parseSet(str, start) {
	if(str[start] != "(") return Result.no(start);
	var i = start + 1;
	var [_, i] = parseWS(start, i);
	var [result, i] = parseNumExpr(start, i);
	var [results, i] = parseStar(
		parseMap(
			parseSeq(
				parseOptional(parseWS),
				parseStr(","),
				parseOptional(parseWS),
				parseCompList,
			),
			(...xs)=>xs[3],
		)
	)(str, i);
	var [_, i] = parseWS(str, i);
	var [_, i] = parseStr(",")(str, i);
	var [_, i] = parseWS(str, i);
	if(str[i] != ")") return Result.no(start);
	i += 1;
	results.unshift(result);
	var [ops, i] = parseStar(parseSetOp)(str, i);
	return Result.yes(new SetVal(results, ops), i);
}
export function parseSetOp(str, i) {
	return parseRegex(/^(k|p)(l|h|<|>)?(\d+)/)(str, start)
		.map(match=>new DiceOp(...match.slice(1)));
}
export function parseLiteral(str, start) {
	return parseDecimal(str, start)
		.map(x=>new LiteralVal(x));
}
export function parseAnno(str, start) {
	var [result, i] = parseRegex(/^\[.*?\]/)(str, start);
	if(!result) return Result.no(start);
	var [_, i] = parseWS(str, i);
	return Result.yes(result[0], i);
}


/* Utility parsers */
export function parseInteger(str, start) {
	var [match, i] = parseRegex(/^\d+/)(str, start);
	if(!match) return Result.no(start);
	return Result.yes(Number(match[0]), i);
}
export function parseDecimal(str, start) {
	var [match, i] = parseRegex(/^\d+(\.\d+)?/)(str, start);
	if(!match) return Result.no(start);
	return Result.yes(Number(match[0]), i);
}
export function parseRegex(regex) { return (str, start) => {
	let re = new RegExp(regex);
	re.lastIndex = start;
	let match = re.exec(str);
	if(!match) return Result.no(start);
	return Result.yes(match, start + match[0].length);
}}
export function parseStr(substr) { return (str, start) => {
	if(str.slice(start, start+substr.length) == substr) {
		return Result.yes(substr, start + substr.length);
	}
	return Result.no(start);
}}
export function parseOptional(parser, def=true) { return (str, start) => {
	var result = parser(str, start);
	result[2] = true;
	return result;
}}
export function parseEither(...parsers) { return (str, start) => {
	// returns a parser that'll run each parser in order
	// and return the result of the first that succeeds
	for(const parser of parsers) {
		const [result, i, valid] = parser(str, start);
		if(!valid) continue;
		return Result.yes(result, i);
	}
	return Result.no(start);
}}
export function parsePlus(parser) { return (str, start) => {
	// matches the parser one or more times
	// and returns an array of results
	const [results, i] = parseStar(parser)(str, start);
	if(results.length == 0) return Result.no(start);
}}
export function parseStar(parser) { return (str, start) => {
	// matches the parser zero or more times
	// and returns an array of results
	const results = [];
	var i = start;
	do {
		var [result, i, valid] = parser(str, i);
		if(valid) results.push(result);
	} while(valid);
	return Result.yes(results, i);
}}
export function parseSeq(...parsers) { return (str, start) => {
	// matches all the parsers in sequence,
	// resolving to an array of results if they all succeed
	const results = [];
	var i = start;
	for(const parser of parsers) {
		var [result, i, valid] = parser(str, start);
		if(!valid) return Result.no(start);
		results.push(result);
	}
	return Result.yes(results, i);
}}
export function parseMap(parser, fn) { return (str, start) => {
	return parser(str, start).map(fn);
}}

export class Result {
	constructor(item, index, valid = true) {
		this.item = item;
		this.i = index;
		this.valid = valid;
	}
	map(fn) {
		if(this.valid) {
			return new Result(fn(this.item), this.i, this.valid);
		} else {
			return this;
		}
	}
	*[Symbol.iterator]() {
		yield this.item;
		yield this.i;
		yield this.valid;
	}
	static yes(item, index) {
		return new Result(item, index, true);
	}
	static no(index) {
		return new Result(null, index, false);
	}
}

class DiceAST {};

class CommentedExpr extends DiceAST {
	constructor(dice, comment = "") {
		super();
		this.dice = dice;
		this.comment = comment;
	}
}

class CompList extends DiceAST {
	constructor(parts) {
		super();
		this.parts = parts;
	}
}

class MathList extends DiceAST {
	constructor(parts) {
		super();
		this.parts = parts;
	}
}

class UnaryMinus extends DiceAST {
	constructor(part) {
		super();
		this.part = part;
	}
}

class NumExpr extends DiceAST {
	constructor(anno) {
		super();
		this.annotation = anno;
	}
}

class DiceVal extends NumExpr {
	constructor(n, d, ops = []) {
		super();
		this.n = n;
		this.d = d;
		this.ops = ops;
	}
}

class LiteralVal extends NumExpr {
	constructor(val) {
		super();
		this.val = val;
	}
}

class DiceOp extends DiceAST {
	constructor(op, sel, n) {
		super();
		this.op = op;
		this.sel = sel;
		this.n = n;
	}
}






export function rollOneDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
export function rollDice(n=1, sides=20, bonus=0) {
  let total = bonus;
  for(var i = 0; i < n; i++) {
	total += rollOneDie(sides);
  }
  return total;
}
export function averageRoll(n=1, sides=20, bonus=0) {
  return Math.floor(bonus + n * (sides+1)/2);
}

export class Dice extends HTMLElement {
  constructor() {
	super();
  }

  connectedCallback() {
	const text = this.textContent.trim();
	let match;
	if(match = /^[+-]\d+$/.exec(text)) {
	  const bonus = parseInt(text, 10);
	  this.addEventListener("click", ()=>{
		const d1 = rollDice(1, 20, bonus);
		const d2 = rollDice(1, 20, bonus);
		const msg = `Rolling 1d20${text[0]}${bonus}  =>  ${d1}\nIf Advantage: ${Math.max(d1, d2)}\nIf Disadvantage: ${Math.min(d1, d2)}`;
		console.log(msg);
		alert(msg);
	  });
	} else if(match = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(text)) {
	  const num = parseInt(match[1], 10);
	  const sides = parseInt(match[2], 10);
	  const bonus = match[3] !== undefined ? parseInt(match[3]+match[4], 10) : 0;
	  this.addEventListener("click", ()=>{
		const msg = `Rolling ${text}  =>  ${rollDice(num, sides, bonus)}`;
		console.log(msg);
		alert(msg);
	  });
	  this.textContent = `${averageRoll(num, sides, bonus)} (${text})`;
	} else if(match = /^[rR]echarge (\d)/.exec(text)) {
	  const num = parseInt(match[1]);
	  this.addEventListener("click", ()=>{
		const roll = rollOneDie(6);
		let msg = roll >= num ? `Recharged! Rolled a ${roll}.` : `Not recharged, rolled a ${roll}.`
		console.log(msg);
		alert(msg);
	  })
	} else {
	  console.log(`Couldn't understand the dice expression '${text}'.`, this);
	  return;
	}
	this.style.textDecoration = "underline";
	this.style.cursor = "pointer";
  }
}

customElements.define('d-', Dice);