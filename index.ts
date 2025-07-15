import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

const settings = definePluginSettings({
	customCdnDomain: {
		type: OptionType.STRING,
		default: "cdn.discordapp.com",
		description: "Your domain to proxy Discord CDN URLs (need to be configured on your own server)",
	},
});

let observer: MutationObserver | null = null;
let originalImageSrcSetter: PropertyDescriptor["set"] | null = null;
const attributeObservers: MutationObserver[] = [];

export default definePlugin({
	name: "ProxyCdn",
	description: "Redirects Discord CDN URLs to a proxy domain (DOM + Image.prototype.src + <img> dynamic patch)",
	authors: [{ name: "Mara-Li", id: 0n }],
	settings,

	start() {
		const cdn = settings.store.customCdnDomain;
		const pattern = /https?:\/\/cdn\.discordapp\.com/g;

		function replaceCdnInNode(node: Node) {
			if (!(node instanceof HTMLElement)) return;

			for (const attr of ["src", "href", "style"]) {
				const val = node.getAttribute(attr);
				if (val && pattern.test(val)) {
					node.setAttribute(attr, val.replace(pattern, `https://${cdn}`));
				}
			}

			if (node.style?.backgroundImage && pattern.test(node.style.backgroundImage)) {
				node.style.backgroundImage = node.style.backgroundImage.replace(
					pattern,
					`https://${cdn}`
				);
			}

			if (node instanceof HTMLImageElement) {
				observeImgAttributeChange(node);
			}
		}

		function observeImgAttributeChange(img: HTMLImageElement) {
			const attrObserver = new MutationObserver(() => {
				if (img.src.includes("cdn.discordapp.com")) {
					img.src = img.src.replace(pattern, `https://${cdn}`);
				}
				if (img.srcset?.includes("cdn.discordapp.com")) {
					img.srcset = img.srcset.replace(pattern, `https://${cdn}`);
				}
			});

			attrObserver.observe(img, {
				attributes: true,
				attributeFilter: ["src", "srcset"],
			});

			attributeObservers.push(attrObserver);
		}

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

		document.querySelectorAll("img").forEach((img) => {
			if (img.src.includes("cdn.discordapp.com")) {
				img.src = img.src.replace(pattern, `https://${cdn}`);
			}
			observeImgAttributeChange(img);
		});

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

		console.log(`[ProxyCdn] Enabled. Redirected to ${cdn}`);
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

		console.log("[ProxyCdn] Disabled. Restored original Image src setter.");
	},
});
