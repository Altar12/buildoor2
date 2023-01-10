import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import { initializeKeypair } from "./initializeKeypair"
import * as fs from "fs"
import { bundlrStorage, findMetadataPda, keypairIdentity, Metaplex, toMetaplexFile } from "@metaplex-foundation/js"
import { DataV2, createCreateMetadataAccountV2Instruction } from "@metaplex-foundation/mpl-token-metadata"

const TOKEN_NAME = "BUILD"
const TOKEN_SYMBOL = "BLD"
const TOKEN_DESCRIPTION = "A token for builders"
const TOKEN_IMAGE_NAME = "jewel.png"
const TOKEN_IMAGE_PATH = `tokens/bld/assets/${TOKEN_IMAGE_NAME}`

async function createBldToken(
    connection: web3.Connection,
    payer: web3.Keypair,
    programId: web3.PublicKey
) {
    const [mintAuth] = await web3.PublicKey.findProgramAddress([Buffer.from("mint")], programId)
    const tokenMint = await token.createMint(connection, payer, payer.publicKey, null, 2)

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer)).use(bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
    }))

    const imageBuffer = fs.readFileSync(TOKEN_IMAGE_PATH)
    const file = toMetaplexFile(imageBuffer, TOKEN_IMAGE_NAME)
    const imageUri = await metaplex.storage().upload(file)

    const { uri } = await metaplex.nfts().uploadMetadata({
        name: TOKEN_NAME,
        description: TOKEN_DESCRIPTION,
        image: imageUri,
    }).run() // adding .run() errors out

    const metadataPda = findMetadataPda(tokenMint)
    const tokenMetadata = {
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
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
    fs.writeFileSync("tokens/bld/cache.json", 
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

    await createBldToken(connection, payer, new web3.PublicKey("HAhTrMoHDx36YYAtobUjG6FCVbaoA5Mv9EiUJLR7pawA"))
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