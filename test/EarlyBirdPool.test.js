const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const { time } = require("./utilities")
const {
  isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace")

const { utils, BigNumber } = ethers

describe("EarlyBirdPool", function() {
  before(async function() {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.ChocToken = await ethers.getContractFactory("ChocToken", this.dev)
    this.EarlyBirdPool = await ethers.getContractFactory(
      "EarlyBirdPool",
      this.dev
    )
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function() {
    this.choc = await this.ChocToken.deploy()
    await this.choc.deployed()
    this.earlyBird = await this.EarlyBirdPool.deploy(this.choc.address, 432000)
    await this.earlyBird.deployed()
    // storing the start block for later
    this.startBlock = await ethers.provider.getBlockNumber()

    // make EarlyBird the minter of the Choc
    await this.choc.setMinter(this.earlyBird.address)
  })

  it("should set the ending block number correctly", async function() {
    const block = await this.earlyBird.endBlock()
    expect(block).to.equal(432000 + this.startBlock) // 1 block is passed since choc.transferOwnership
  })

  it("should allow users to deposit", async function() {
    await this.earlyBird.connect(this.alice).deposit({
      from: this.alice.address,
      value: ethers.utils.parseEther("10.5"),
    })
    const balance = await this.earlyBird.getBalance(this.alice.address)
    expect(ethers.utils.formatEther(balance)).to.equal("10.5")
  })

  it("should calculate choc rewards correctly", async function() {
    const bobWallet = this.earlyBird.connect(this.bob)

    await bobWallet.deposit({
      from: this.bob.address,
      value: ethers.utils.parseEther("1"),
    })

    let currentBlock = await ethers.provider.getBlockNumber()

    const chocsPerHour = 10
    const blockDiff = 10
    const blocksPerHour = 600

    // in 10 blocks (~1 min)
    await time.advanceBlockTo(currentBlock + blockDiff)

    const pending2 = await bobWallet.pendingChoc()
    let rewardFor10Blocks = utils
      .parseUnits("1", 18)
      .mul(BigNumber.from(blockDiff))
      .mul(BigNumber.from(chocsPerHour))
      .div(BigNumber.from(blocksPerHour))

    expect(pending2).to.equal(rewardFor10Blocks.toString())

    currentBlock = await ethers.provider.getBlockNumber()

    // In 600 blocks (~one hour)
    await time.advanceBlockTo(currentBlock + 590)
    const pending3 = await bobWallet.pendingChoc()
    // 1 BCH staked in one hour should have a reward of 10 CHOCs
    expect(pending3).to.equal(utils.parseUnits("10", 18))
  })

  it("should calculate choc rewards for stakes below 1 BCH correctly", async function() {
    const bobWallet = this.earlyBird.connect(this.bob)
    await bobWallet.deposit({
      from: this.bob.address,
      value: ethers.utils.parseEther("0.0001"),
    })
    let currentBlock = await ethers.provider.getBlockNumber()
    const blocksPerHour = 600

    const pending1 = await bobWallet.pendingChoc()
    expect(pending1.toString()).to.equal("0")

    currentBlock = await ethers.provider.getBlockNumber()

    // In 600 blocks (~one hour)
    await time.advanceBlockTo(currentBlock + blocksPerHour)
    const pending2 = await bobWallet.pendingChoc()
    // 0.0001 BCH staked in one hour should have a reward of 0.001 CHOCs
    expect(pending2).to.equal(utils.parseUnits("0.001", 18))
  })

  it("should allow the staker to exit with the right amount", async function() {
    const bobWallet = this.earlyBird.connect(this.bob)

    // deposit some BCH
    await bobWallet.deposit({
      from: this.bob.address,
      value: ethers.utils.parseEther("3.500231"),
    })

    const balanceAfterDeposit = await ethers.provider.getBalance(
      this.bob.address
    )

    let balanceInContract = await bobWallet.getBalance(this.bob.address)
    expect(ethers.utils.formatEther(balanceInContract)).to.equal("3.500231")

    // withdraw the deposit + yields
    await bobWallet.exit()

    // balance in contract should be zero now
    balanceInContract = await bobWallet.getBalance(this.bob.address)
    expect(balanceInContract.toNumber()).to.equal(0)

    // Bob's balance should be +3.500231 BCH now
    const bobBalance = await ethers.provider.getBalance(this.bob.address)
    expect(parseFloat(ethers.utils.formatEther(bobBalance))).is.greaterThan(
      // exact amount is not predictable due to gas costs
      parseFloat(ethers.utils.formatEther(balanceAfterDeposit)) + 3.5
    )
  })
})
