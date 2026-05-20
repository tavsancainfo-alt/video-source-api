/*
written by @cool-dev-guy
github: https://github.com/cool-dev-guy
*/
/*
NOTES: The current code is compatible to use as a module in nodejs projects.
import * as cheerio from "cheerio"; // FOR NODE.JS
import * as cheerio from "npm:cheerio"; // FOR DENO
*/
import * as cheerio from "cheerio";
import { decrypt } from "./helpers/decoder.js";
let BASEDOM = "https://whisperingauroras.com";
const EMBED_BASE_URL = process.env.VIDSRC_BASE_URL || "https://vidsrc.me";
async function serversLoad(html) {
    const $ = cheerio.load(html);
    const servers = [];
    const title = $("title").text() ?? "";
    const base = $("iframe").attr("src") ?? "";
    BASEDOM = new URL(base.startsWith("//") ? "https:" + base : base).origin ?? BASEDOM;
    $(".serversList .server").each((index, element) => {
        const server = $(element);
        servers.push({
            name: server.text().trim(),
            dataHash: server.attr("data-hash") ?? null,
        });
    });
    return {
        servers: servers,
        title: title,
    };
}
async function SRCRCPhandler() {
}
async function PRORCPhandler(prorcp) {
    const prorcpFetch = await fetch(`${BASEDOM}/prorcp/${prorcp}`);
    const prorcpResponse = await prorcpFetch.text();
    const scripts = prorcpResponse.match(/<script\s+src="\/([^"]*\.js)\?\_=([^"]*)"><\/script>/gm);
    const script = (scripts?.[scripts.length - 1].includes("cpt.js"))
        ? scripts?.[scripts.length - 2].replace(/.*src="\/([^"]*\.js)\?\_=([^"]*)".*/, "$1?_=$2")
        : scripts?.[scripts.length - 1].replace(/.*src="\/([^"]*\.js)\?\_=([^"]*)".*/, "$1?_=$2");
    const jsFileReq = await fetch(`${BASEDOM}/${script}`, {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "priority": "u=1",
            "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "script",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-site": "same-origin",
            "Referer": `${BASEDOM}/`,
            "Referrer-Policy": "origin",
        },
        "body": null,
        "method": "GET",
    });
    const jsCode = await jsFileReq.text();
    const decryptRegex = /{}\}window\[([^"]+)\("([^"]+)"\)/;
    const decryptMatches = jsCode.match(decryptRegex);
    // ^ this func is the decrypt function (fn name)
    const $ = cheerio.load(prorcpResponse);
    if (!decryptMatches || decryptMatches?.length < 3)
        return null;
    const id = decrypt(decryptMatches[2].toString().trim(), decryptMatches[1].toString().trim());
    const data = $("#" + id);
    const result = await decrypt(await data.text(), decryptMatches[2].toString().trim());
    return result;
}
async function rcpGrabber(html) {
    const regex = /src:\s*'([^']*)'/;
    const match = html.match(regex);
    if (!match)
        return null;
    return {
        metadata: {
            image: "",
        },
        data: match[1],
    };
}
async function tmdbScrape(tmdbId, type, season, episode) {
    if (season && episode && (type === "movie")) {
        throw new Error("Invalid Data.");
    }
    const url = (type === "movie")
        ? `${EMBED_BASE_URL}/embed/${type}?tmdb=${tmdbId}`
        : `${EMBED_BASE_URL}/embed/${type}?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
    const embed = await fetch(url);
    const embedResp = await embed.text();
    // get some metadata
    const { servers, title } = await serversLoad(embedResp);
    const rcpFetchPromises = servers.map(element => {
        return fetch(`${BASEDOM}/rcp/${element.dataHash}`);
    });
    const rcpResponses = await Promise.all(rcpFetchPromises);
    const prosrcrcp = await Promise.all(rcpResponses.map(async (response) => {
        return rcpGrabber(await response.text());
    }));
    const apiResponse = [];
    for (const item of prosrcrcp) {
        if (!item)
            continue;
        switch (item.data.substring(0, 8)) {
            case "/prorcp/":
                apiResponse.push({
                    name: title,
                    image: item.metadata.image,
                    mediaId: tmdbId,
                    stream: await PRORCPhandler(item.data.replace("/prorcp/", "")),
                    referer: BASEDOM,
                });
                break;
        }
    }
    return apiResponse;
}
export default tmdbScrape;
