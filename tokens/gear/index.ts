import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import { initializeKeypair } from "./initializeKeypair"
import * as fs from "fs"
import { bundlrStorage, findMetadataPda, keypairIdentity, Metaplex, toMetaplexFile } from "@metaplex-foundation/js"
import { DataV2, createCreateMetadataAccountV2Instruction } from "@metaplex-foundation/mpl-token-metadata"

async function createBldToken(
    connection: web3.Connection,
    payer: web3.Keypair,
    programId: web3.PublicKey,
    gear: string
) {
    const [mintAuth] = web3.PublicKey.findProgramAddressSync([Buffer.from("mint")], programId)
    const tokenMint = await token.createMint(connection, payer, payer.publicKey, null, 0)

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer)).use(bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
    }))

    const imageBuffer = fs.readFileSync(`./assets/${gear}.png`)
    const file = toMetaplexFile(imageBuffer, `${gear}.png`)
    const imageUri = await metaplex.storage().upload(file)

    const { uri } = await metaplex.nfts().uploadMetadata({
        name: gear,
        description: "Fancy gear for your buildoor",
        image: imageUri,
    }).run() // adding .run() errors out

    const metadataPda = findMetadataPda(tokenMint)
    const tokenMetadata = {
        name: gear,
        symbol: "BLDRGEAR",
        uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null
    } as DataV2

    const instruction = createCreateMetadataAccountV2Instruction({
        metadata: metadataPda,
        mint: tokenMint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey
    }, {
        createMetadataAccountArgsV2: {
            data: tokenMetadata,
            isMutable: true
        }
    })

    const transaction = new web3.Transaction()
    transaction.add(instruction)

    const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer])
    console.log("created metadata account")
    console.log(`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`)
    fs.appendFileSync("./cache.json", 
        JSON.stringify({
            mint: tokenMint.toBase58(),
            imageUri,
            metadataUri: uri,
            tokenMetadata: metadataPda.toBase58(),
            metadataTransaction: transactionSignature,
        }))
        const sign = await token.setAuthority(
            connection,
            payer,
            tokenMint,
            payer.publicKey,
            token.AuthorityType.MintTokens,
            mintAuth
          )
        console.log("updated mint authority")
        console.log(`https://explorer.solana.com/tx/${sign}?cluster=devnet`)

}

async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const payer = await initializeKeypair(connection)

    await createBldToken(connection, payer, new web3.PublicKey("5vA5NXuB3ZA3TZepwSxxhWsDvU8MWEyqBZdvnEAF95k3"), "Keyboard")
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })