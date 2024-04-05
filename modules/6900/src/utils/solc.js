"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSolc = void 0;
const solc_1 = __importDefault(require("solc"));
const solcCache = {};
const loadSolc = async (version) => {
    return await new Promise((resolve, reject) => {
        if (solcCache[version] !== undefined)
            resolve(solcCache[version]);
        else
            solc_1.default.loadRemoteVersion(`v${version}`, (error, solcjs) => {
                solcCache[version] = solcjs;
                return error ? reject(error) : resolve(solcjs);
            });
    });
};
exports.loadSolc = loadSolc;
