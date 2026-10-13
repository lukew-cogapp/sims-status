import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-700.css";
import "./style.css";

type Need = { label: string; value: number; trend: number };
type State = { name: string; mood?: string; needs: Need[] };

const DEFAULTS: State = {
	name: "Luke",
	mood: "No Sleep",
	needs: [
		{ label: "Hunger", value: 35, trend: -1 },
		{ label: "Energy", value: 0, trend: -2 },
		{ label: "Bladder", value: 55, trend: -1 },
		{ label: "Fun", value: 0, trend: 0 },
		{ label: "Social", value: 20, trend: 0 },
		{ label: "Hygiene", value: 85, trend: 0 },
		{ label: "Comfort", value: 25, trend: 0 },
		{ label: "Environment", value: 50, trend: 0 },
	],
};
const STORE_KEY = "needs-panel";
const PANEL_W = 560;
const PANEL_FRAME = "#1e2a52";

const $ = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T;

let state = load();

function load(): State {
	try {
		const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
		if (saved && Array.isArray(saved.needs)) return saved;
	} catch {}
	return structuredClone(DEFAULTS);
}

function save() {
	try {
		localStorage.setItem(STORE_KEY, JSON.stringify(state));
	} catch {}
}

// Red at empty through yellow to green at full, like the in-game bars.
function needHue(value: number) {
	return Math.round((value / 100) * 130);
}

function mood(needs: Need[]) {
	if (!needs.length) return { text: "Fine", hue: 60 };
	const avg = needs.reduce((s, n) => s + n.value, 0) / needs.length;
	const text =
		avg >= 80
			? "Very Happy"
			: avg >= 60
				? "Happy"
				: avg >= 40
					? "Fine"
					: avg >= 20
						? "Uncomfortable"
						: "Miserable";
	return { text, hue: needHue(avg) };
}

function trendLabel(t: number) {
	return t === 0 ? "–" : (t > 0 ? "▲" : "▼").repeat(Math.abs(t));
}

function renderEditor() {
	$<HTMLInputElement>("name").value = state.name;
	$<HTMLInputElement>("mood").value = state.mood ?? "";
	const list = $("needs");
	list.replaceChildren();
	state.needs.forEach((need, i) => {
		const row = document.createElement("div");
		row.className = "need";

		const label = document.createElement("input");
		label.type = "text";
		label.id = `need-label-${i}`;
		label.value = need.label;
		label.setAttribute("aria-label", "Need name");
		label.addEventListener("input", () => {
			need.label = label.value;
			update();
		});

		const range = document.createElement("input");
		range.type = "range";
		range.id = `need-value-${i}`;
		range.min = "0";
		range.max = "100";
		range.value = String(need.value);
		range.setAttribute("aria-label", `${need.label} level`);
		range.addEventListener("input", () => {
			need.value = Number(range.value);
			update();
		});

		const trend = document.createElement("select");
		trend.id = `need-trend-${i}`;
		trend.setAttribute("aria-label", `${need.label} trend`);
		for (let t = 3; t >= -3; t--) {
			const opt = new Option(trendLabel(t), String(t));
			opt.selected = t === need.trend;
			trend.append(opt);
		}
		trend.addEventListener("change", () => {
			need.trend = Number(trend.value);
			update();
		});

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "icon";
		remove.textContent = "×";
		remove.setAttribute("aria-label", `Remove ${need.label}`);
		remove.addEventListener("click", () => {
			state.needs.splice(i, 1);
			renderEditor();
			update();
		});

		row.append(label, range, trend, remove);
		list.append(row);
	});
}

type Point = [number, number];

function drawPlumbob(
	ctx: CanvasRenderingContext2D,
	cx: number,
	top: number,
	hue: number,
) {
	const w = 15;
	const mid = top + 24;
	const bottom = top + 62;
	const facet = (pts: Point[], light: number) => {
		ctx.beginPath();
		ctx.moveTo(...pts[0]);
		for (const p of pts.slice(1)) ctx.lineTo(...p);
		ctx.closePath();
		ctx.fillStyle = `hsl(${hue} 80% ${light}%)`;
		ctx.fill();
	};
	facet(
		[
			[cx, top],
			[cx - w, mid],
			[cx, mid + 4],
		],
		72,
	);
	facet(
		[
			[cx, top],
			[cx + w, mid],
			[cx, mid + 4],
		],
		55,
	);
	facet(
		[
			[cx - w, mid],
			[cx, mid + 4],
			[cx, bottom],
		],
		45,
	);
	facet(
		[
			[cx + w, mid],
			[cx, mid + 4],
			[cx, bottom],
		],
		32,
	);
}

// Sims 3 style: falling needs get pink arrows left of the bar, rising ones green arrows on the right.
function drawTrend(
	ctx: CanvasRenderingContext2D,
	barX: number,
	barW: number,
	cy: number,
	trend: number,
) {
	if (!trend) return;
	const up = trend > 0;
	ctx.fillStyle = up ? "#3fbf2a" : "#d23c86";
	for (let i = 0; i < Math.abs(trend); i++) {
		ctx.beginPath();
		if (up) {
			const ax = barX + barW + 6 + i * 8;
			ctx.moveTo(ax, cy - 5);
			ctx.lineTo(ax + 6, cy);
			ctx.lineTo(ax, cy + 5);
		} else {
			const ax = barX - 6 - i * 8;
			ctx.moveTo(ax, cy - 5);
			ctx.lineTo(ax - 6, cy);
			ctx.lineTo(ax, cy + 5);
		}
		ctx.closePath();
		ctx.fill();
	}
}

const HEADER_H = 84;
const CELL_H = 58;
const CELL_GAP = 6;
const PAD = 16;

function panelHeight() {
	const rows = Math.ceil(state.needs.length / 2);
	return HEADER_H + rows * (CELL_H + CELL_GAP) - CELL_GAP + PAD;
}

function draw(ctx: CanvasRenderingContext2D, opaque: boolean) {
	const W = PANEL_W;
	const H = panelHeight();
	ctx.clearRect(0, 0, W, H);
	if (opaque) {
		ctx.fillStyle = PANEL_FRAME;
		ctx.fillRect(0, 0, W, H);
	}

	ctx.beginPath();
	ctx.roundRect(0, 0, W, H, 18);
	ctx.fillStyle = PANEL_FRAME;
	ctx.fill();
	ctx.beginPath();
	ctx.roundRect(5, 5, W - 10, H - 10, 14);
	ctx.fillStyle = "#6c8cd1";
	ctx.fill();

	const m = mood(state.needs);
	drawPlumbob(ctx, PAD + 20, 12, m.hue);

	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	ctx.fillStyle = "#ffffff";
	ctx.font = "800 28px 'Baloo 2', sans-serif";
	ctx.fillText(state.name || "Unnamed Sim", PAD + 52, 44);
	ctx.font = "700 15px 'Nunito Sans', sans-serif";
	ctx.fillStyle = "#14255a";
	ctx.fillText(`Mood: ${state.mood || m.text}`, PAD + 52, 66);

	const colW = (W - PAD * 2 - CELL_GAP) / 2;
	state.needs.forEach((need, i) => {
		const x = PAD + (i % 2) * (colW + CELL_GAP);
		const y = HEADER_H + Math.floor(i / 2) * (CELL_H + CELL_GAP);

		ctx.beginPath();
		ctx.roundRect(x, y, colW, CELL_H, 6);
		ctx.fillStyle = "#7c9fdf";
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = "#4a6bad";
		ctx.stroke();

		ctx.textAlign = "center";
		ctx.fillStyle = "#14255a";
		ctx.font = "700 15px 'Nunito Sans', sans-serif";
		ctx.fillText(need.label, x + colW / 2, y + 22);

		const barW = colW * 0.62;
		const barX = x + (colW - barW) / 2;
		const barY = y + 33;
		const barH = 12;
		const trough = ctx.createLinearGradient(0, barY, 0, barY + barH);
		trough.addColorStop(0, "#a6d0ef");
		trough.addColorStop(0.35, "#6296a4");
		trough.addColorStop(1, "#396490");
		ctx.beginPath();
		ctx.roundRect(barX, barY, barW, barH, barH / 2);
		ctx.fillStyle = trough;
		ctx.fill();

		const fw = barW * (need.value / 100);
		if (fw > 0) {
			const hue = needHue(need.value);
			const fill = ctx.createLinearGradient(0, barY, 0, barY + barH);
			fill.addColorStop(0, `hsl(${hue} 70% 70%)`);
			fill.addColorStop(0.35, `hsl(${hue} 72% 45%)`);
			fill.addColorStop(1, `hsl(${hue} 82% 30%)`);
			ctx.beginPath();
			ctx.roundRect(barX, barY, fw, barH, barH / 2);
			ctx.fillStyle = fill;
			ctx.fill();
		}

		ctx.beginPath();
		ctx.roundRect(barX, barY, barW, barH, barH / 2);
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = "#1f5a6e";
		ctx.stroke();

		drawTrend(ctx, barX, barW, barY + barH / 2, need.trend);
	});
	ctx.textAlign = "left";
}

function renderTo(canvas: HTMLCanvasElement, scale: number, opaque: boolean) {
	canvas.width = PANEL_W * scale;
	canvas.height = panelHeight() * scale;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	draw(ctx, opaque);
}

function update() {
	const preview = $<HTMLCanvasElement>("card");
	renderTo(preview, window.devicePixelRatio || 1, false);
	preview.style.width = `${PANEL_W}px`;
	save();
}

$<HTMLInputElement>("name").addEventListener("input", (e) => {
	state.name = (e.target as HTMLInputElement).value;
	update();
});
$<HTMLInputElement>("mood").addEventListener("input", (e) => {
	state.mood = (e.target as HTMLInputElement).value;
	update();
});
$("add").addEventListener("click", () => {
	state.needs.push({ label: "New need", value: 50, trend: 0 });
	renderEditor();
	update();
});
$("random").addEventListener("click", () => {
	for (const n of state.needs) {
		n.value = Math.floor(Math.random() * 101);
		n.trend = Math.floor(Math.random() * 7) - 3;
	}
	renderEditor();
	update();
});
$("reset").addEventListener("click", () => {
	state = structuredClone(DEFAULTS);
	renderEditor();
	update();
});
$("download").addEventListener("click", () => {
	const type = $<HTMLSelectElement>("format").value;
	const scale = Number($<HTMLSelectElement>("scale").value);
	const canvas = document.createElement("canvas");
	renderTo(canvas, scale, type === "image/jpeg");
	canvas.toBlob(
		(blob) => {
			if (!blob) return;
			const a = document.createElement("a");
			const slug = (state.name || "sim")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			a.href = URL.createObjectURL(blob);
			a.download = `${slug || "sim"}-needs.${type === "image/jpeg" ? "jpg" : "png"}`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		},
		type,
		0.92,
	);
});

renderEditor();
update();
// Canvas text doesn't wait for web fonts, so redraw once they arrive.
Promise.all([
	document.fonts.load("800 30px 'Baloo 2'"),
	document.fonts.load("700 15px 'Nunito Sans'"),
]).then(update, update);
