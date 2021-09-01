const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const { time } = require("./utilities")
const {
  isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace")

describe("EarlyBirdPool", function() {
  before(async function() {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.CerealToken = await ethers.getContractFactory("CerealToken", this.dev)
    this.EarlyBirdPool = await ethers.getContractFactory(
      "EarlyBirdPool",
      this.dev
    )
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function() {
    this.cereal = await this.CerealToken.deploy()
    await this.cereal.deployed()
    this.earlyBird = await this.EarlyBirdPool.deploy(this.cereal.address, 100)
    await this.earlyBird.deployed()
    // storing the start block for later
    this.startBlock = await ethers.provider.getBlockNumber()

    // make EarlyBird the owner of the Cereal
    await this.cereal.transferOwnership(this.earlyBird.address)
  })

  it("should set the ending block number correctly", async function() {
    const block = await this.earlyBird.endBlock()
    expect(block).to.equal(100 + this.startBlock) // 1 block is passed since cereal.transferOwnership
  })

  it("should allow users to deposit", async function() {
    await this.earlyBird.connect(this.alice).deposit({
      from: this.alice.address,
      value: ethers.utils.parseEther("10.5"),
    })
    const balance = await this.earlyBird.getBalance(this.alice.address)
    expect(ethers.utils.formatEther(balance)).to.equal("10.5")
  })

  it("should calculate cereal rewards correctly", async function() {
    const bobWallet = this.earlyBird.connect(this.bob)
    await bobWallet.deposit({
      from: this.bob.address,
      value: ethers.utils.parseEther("10"),
    })
    let currentBlock = await ethers.provider.getBlockNumber()
    const rewardsPerHour = 100
    const blocksPerHour = 600

    const pending1 = await bobWallet.pendingCereal()
    expect(pending1.toString()).to.equal("0")

    // in 10 blocks (~1 min)
    await time.advanceBlockTo(currentBlock + 10)

    const pending2 = await bobWallet.pendingCereal()
    let rewardFor10Blocks = Math.floor(
      (10 * rewardsPerHour * 10) / blocksPerHour
    )
    rewardFor10Blocks = rewardFor10Blocks - Math.floor(rewardFor10Blocks / 10)
    expect(pending2.toNumber()).to.equal(rewardFor10Blocks)

    currentBlock = await ethers.provider.getBlockNumber()

    // In 600 blocks (~one hour)
    await time.advanceBlockTo(currentBlock + 590)
    const pending3 = await bobWallet.pendingCereal()
    // 10 BCH staked in one hour should have a reward of 900 CREALs
    expect(pending3.toNumber()).to.equal(900)
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

    // TODO: calculate yields
  })
})
