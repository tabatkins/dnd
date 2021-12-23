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