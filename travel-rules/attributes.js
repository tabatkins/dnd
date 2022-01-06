class AttributeBlock extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		const match = (/(\d+)\D+(\d+)\D+(\d+)\D+(\d+)\D+(\d+)\D+(\d+)/s).exec(this.textContent);
		if(!match) return console.log("Couldn't parse out an attributes block.", this);
		const shadow = this.attachShadow({mode:'open'});
		shadow.appendChild(el('table', {},
			el('thead', {},
				el('tr', {},
					...["STR", "DEX", "CON", "INT", "WIS", "CHA"].map(x=>
						el('th', {}, x)
					),
				),
			),
			el('tbody', {},
				el('tr', {},
					...match.slice(1).map(x=>el('td', {}, `${x} (`, attrMod(x), ')')),
				),
			),
		));
		shadow.appendChild(el('style', {}, `
			table {
				table-layout:  fixed;
				width: 100%;
				border-spacing: 0;
			}
			td, th {
				width: calc(100% / 6);
				text-align: center;
			}
		`));
	}
}

customElements.define('attributes-', AttributeBlock);

function attrMod(x) {
	const mod = Math.floor((x-10)/2);
	return el('d-', {}, `${mod >= 0 ? "+" : ""}${mod}`);
}

function el(name, attrs, ...content) {
    const x = document.createElement(name);
    for(const [k,v] of Object.entries(attrs)) {
        x.setAttribute(k, v);
    }
    for(let child of content) {
        if(typeof child == "string") child = document.createTextNode(child);
        try {
        	x.appendChild(child);
        } catch(e) {
        	console.log({x, child});
        }
    }
    return x;
}