import { Ed25519Provider } from "key-did-provider-ed25519";
import KeyDidResolver from "key-did-resolver";
import { DID } from "dids";
import CeramicClient from "@ceramicnetwork/http-client";

import { ModelManager } from "@glazed/devtools";

export class CryptoUtils {
  static xmur3(str: string): () => number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      (h = Math.imul(h ^ str.charCodeAt(i), 3432918353)),
        (h = (h << 13) | (h >>> 19));
    }

    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  static sfc32(a: number, b: number, c: number, d: number): () => number {
    return function () {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  static randomInt(
    randomFunc: () => number,
    low: number,
    high: number
  ): number {
    return Math.floor(randomFunc() * (high - low) + low);
  }

  static randomBytes(length: number, seed: string): Uint8Array {
    // The seed is any string, we can use that to seed the hash method.
    const hash = this.xmur3(seed);

    // Output four 32-bit hashes to provide the seed for sfc32
    const randFunc = this.sfc32(hash(), hash(), hash(), hash());

    const out = new Uint8Array(length);
    for (let i = 0; i < out.length; i++) {
      out[i] = CryptoUtils.randomInt(randFunc, 0, 256);
    }
    return out;
  }
}

const providerSeed = CryptoUtils.randomBytes(
  32,
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
);
console.log("providerSeed", providerSeed);

const ceramic = new CeramicClient("https://ceramic-clay.3boxlabs.com");

const authProvider = new Ed25519Provider(providerSeed);

ceramic.did = new DID({
  provider: authProvider,
  resolver: KeyDidResolver.getResolver()
});

const manager = new ModelManager(ceramic);

const authenticateDid = async () => {
  await ceramic.did?.authenticate();
  console.log("did", ceramic.did);
};

const createSchemaAndDefinition = async () => {
  console.log("manager", manager.createSchema.toString());

  const lazyMintingSignatureID = await manager.createSchema(
    "LazyMintingSignature1",
    {
      $schema: "http://json-schema.org/draft-07/schema",
      title: "LazyMintingSignature1",
      type: "object",
      properties: {
        data: {
          type: "array",
          title: "data",
          items: {
            type: "array",
            title: "RegistrarSignatureItem",
            properties: {
              registrarAddress: {
                type: "string",
                title: "registrarAddress",
                maxLength: 500
              },
              mintingSignature: {
                type: "string",
                title: "mintingSignature",
                maxLength: 1000
              }
            }
          }
        }
      },
      required: ["data"]
    }
  );

  await manager.createDefinition("LazyMintingSignature1", {
    name: "LazyMintingSignature1",
    description: "A simple LazyMintingSignature1",
    schema: manager.getSchemaURL(lazyMintingSignatureID) as string
  });
};

const initialize = async () => {
  await authenticateDid();
  await createSchemaAndDefinition();
  const model = await manager.toPublished();
  console.log("model", model);
};

initialize();
