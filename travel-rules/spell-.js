//https://www.dndbeyond.com/spells/mirror-image
export class Spell extends HTMLElement {
	constructor() {
		super();

		const spellName = this.textContent;
		const urlSpellName = spellName.toLowerCase().trim().replace(/\s+/, "-").replace(/[^a-z-]/, "");

		const shadow = this.attachShadow({mode:'open'});
		const link = document.createElement('a');
		link.href = "https://www.dndbeyond.com/spells/" + urlSpellName;
		link.textContent = spellName;
		shadow.appendChild(link);

		const style = document.createElement('style');
		style.textContent = `
			a {
				color: blue;
			}
			a:visited {
				color:  purple;
			}`;
		shadow.appendChild(style);
	}
}
customElements.define("spell-", Spell);