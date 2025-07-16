import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

const settings = definePluginSettings({
	customCdnDomain: {
		type: OptionType.STRING,
		default: "www.cdn.mara-li.fr",
		description: "Domaine du proxy CDN",
	},
});

let observer: MutationObserver | null = null;
let originalImageSrcSetter: PropertyDescriptor["set"] | null = null;
const attributeObservers: MutationObserver[] = [];

export default definePlugin({
	name: "ProxyCdn",
	description: "Redirige les URLs Discord CDN vers un domaine proxy (DOM + Image.prototype.src + patchs dynamiques)",
	authors: [{ name: "Lili", id: 0n }],
	settings,

	start() {
		const cdn = settings.store.customCdnDomain;
		const pattern = /https?:\/\/cdn\.discordapp\.com/g;

		/** 👁️ Observe les changements dynamiques de src, srcset ou style */
		function observeAttributes(node: HTMLElement) {
			const obs = new MutationObserver(() => {
				// 🎯 Redirige src et srcset si c’est une image
				if (node instanceof HTMLImageElement) {
					if (node.src && pattern.test(node.src)) {
						node.src = node.src.replace(pattern, `https://${cdn}`);
					}
					if (node.srcset && pattern.test(node.srcset)) {
						node.srcset = node.srcset.replace(pattern, `https://${cdn}`);
					}
				}

				// 🎯 Redirige background-image dans les styles
				const bg = node.style?.backgroundImage;
				if (bg && pattern.test(bg)) {
					node.style.backgroundImage = bg.replace(pattern, `https://${cdn}`);
				}
			});

			obs.observe(node, {
				attributes: true,
				attributeFilter: ["src", "srcset", "style"],
			});

			attributeObservers.push(obs);
		}

		/** 🔁 Remplace les URLs CDN dans un élément */
		function replaceCdnInNode(node: Node) {
			if (!(node instanceof HTMLElement)) return;

			// Attributs HTML (src, href, style)
			for (const attr of ["src", "href", "style"]) {
				const val = node.getAttribute(attr);
				if (val && pattern.test(val)) {
					node.setAttribute(attr, val.replace(pattern, `https://${cdn}`));
				}
			}

			// Styles en ligne (background-image)
			const bgImage = node.style?.backgroundImage;
			if (bgImage && pattern.test(bgImage)) {
				node.style.backgroundImage = bgImage.replace(pattern, `https://${cdn}`);
			}

			// Ajoute l'observateur dynamique
			observeAttributes(node);
		}

		// 🔁 Observe les mutations DOM
		observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;
					replaceCdnInNode(node);
					node.querySelectorAll("*").forEach(replaceCdnInNode);
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// 🔄 Applique au DOM déjà présent
		document.querySelectorAll<HTMLElement>("*").forEach(replaceCdnInNode);

		// 🧠 Patch global d’Image.prototype.src
		const descriptor = Object.getOwnPropertyDescriptor(Image.prototype, "src");
		if (descriptor?.set) {
			originalImageSrcSetter = descriptor.set;
			Object.defineProperty(Image.prototype, "src", {
				set(value: string) {
					if (typeof value === "string" && pattern.test(value)) {
						value = value.replace(pattern, `https://${cdn}`);
					}
					return originalImageSrcSetter!.call(this, value);
				},
			});
		}

		console.log(`[ProxyCdn] Activé. Redirection vers ${cdn}`);
	},

	stop() {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		attributeObservers.forEach((obs) => obs.disconnect());
		attributeObservers.length = 0;

		if (originalImageSrcSetter) {
			Object.defineProperty(Image.prototype, "src", {
				set: originalImageSrcSetter,
			});
			originalImageSrcSetter = null;
		}

		console.log("[ProxyCdn] Désactivé");
	},
});