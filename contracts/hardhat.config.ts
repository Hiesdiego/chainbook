import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem'
import { defineConfig } from 'hardhat/config'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    compilers: [
      {
        version: '0.8.30',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    somniaTestnet: {
      type: 'http',
      url: process.env.SOMNIA_RPC_HTTP || 'https://dream-rpc.somnia.network',
      chainId: 50312,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
})
