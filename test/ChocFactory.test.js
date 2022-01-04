const { ethers } = require("hardhat")
const { expect } = require("chai")
const { time } = require("./utilities")

describe("ChocFactory", function() {
  before(async function() {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.ChocFactory = await ethers.getContractFactory("ChocFactory")
    this.ChocToken = await ethers.getContractFactory("ChocToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function() {
    this.choc = await this.ChocToken.deploy()
    await this.choc.deployed()
  })

  it("should set correct state variables", async function() {
    this.factory = await this.ChocFactory.deploy(
      this.choc.address,
      this.dev.address,
      "100"
    )
    await this.factory.deployed()

    await this.choc.transferOwnership(this.factory.address)

    const choc = await this.factory.choc()
    const devaddr = await this.factory.devaddr()
    const owner = await this.choc.owner()

    expect(choc).to.equal(this.choc.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(owner).to.equal(this.factory.address)
  })

  it("should allow dev and only dev to update dev", async function() {
    this.factory = await this.ChocFactory.deploy(
      this.choc.address,
      this.dev.address,
      "100"
    )
    await this.factory.deployed()

    expect(await this.factory.devaddr()).to.equal(this.dev.address)

    await expect(
      this.factory
        .connect(this.bob)
        .dev(this.bob.address, { from: this.bob.address })
    ).to.be.revertedWith("dev: wut?")

    await this.factory
      .connect(this.dev)
      .dev(this.bob.address, { from: this.dev.address })

    expect(await this.factory.devaddr()).to.equal(this.bob.address)

    await this.factory
      .connect(this.bob)
      .dev(this.alice.address, { from: this.bob.address })

    expect(await this.factory.devaddr()).to.equal(this.alice.address)
  })

  context("With ERC/LP token added to the field", function() {
    beforeEach(async function() {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000")

      await this.lp2.transfer(this.alice.address, "1000")

      await this.lp2.transfer(this.bob.address, "1000")

      await this.lp2.transfer(this.carol.address, "1000")
    })

    it("should allow emergency withdraw", async function() {
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "100"
      )
      await this.factory.deployed()

      await this.factory.add("100", this.lp.address, true)

      await this.lp
        .connect(this.bob)
        .approve(this.factory.address, "1000", { from: this.bob.address })

      await this.factory
        .connect(this.bob)
        .deposit(0, "100", { from: this.bob.address })

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.factory
        .connect(this.bob)
        .emergencyWithdraw(0, { from: this.bob.address })

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should give out CHOCs only after farming time", async function() {
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "100"
      )
      await this.factory.deployed()

      await this.choc.transferOwnership(this.factory.address)

      await this.factory.add("100", this.lp.address, true)

      await this.lp
        .connect(this.bob)
        .approve(this.factory.address, "1000", { from: this.bob.address })
      await this.factory
        .connect(this.bob)
        .deposit(0, "100", { from: this.bob.address })
      await time.advanceBlockTo("89")

      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 90
      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")
      await time.advanceBlockTo("94")

      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 95
      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")
      await time.advanceBlockTo("99")

      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 100
      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")
      await time.advanceBlockTo("100")

      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 101
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("10", 18).toString()
      ) // 10.0 CHOC

      await time.advanceBlockTo("104")
      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 105

      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("50", 18).toString() // 50.0 CHOC
      )
      expect(await this.choc.balanceOf(this.dev.address)).to.equal(
        ethers.utils.parseUnits("5", 18).toString() // 5.0 CHOC
      )
      expect(await this.choc.totalSupply()).to.equal(
        ethers.utils.parseUnits("55", 18).toString() // 55.0 CHOC
      )
    })

    it("should not distribute CHOCs if no one deposit", async function() {
      // 10 per block farming rate starting at block 200
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "200"
      )
      await this.factory.deployed()
      await this.choc.transferOwnership(this.factory.address)
      await this.factory.add("100", this.lp.address, true)
      await this.lp
        .connect(this.bob)
        .approve(this.factory.address, "1000", { from: this.bob.address })
      await time.advanceBlockTo("199")
      expect(await this.choc.totalSupply()).to.equal("0")
      await time.advanceBlockTo("204")
      expect(await this.choc.totalSupply()).to.equal("0")
      await time.advanceBlockTo("209")
      await this.factory
        .connect(this.bob)
        .deposit(0, "10", { from: this.bob.address }) // block 210
      expect(await this.choc.totalSupply()).to.equal("0")
      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.choc.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      await time.advanceBlockTo("219")
      await this.factory
        .connect(this.bob)
        .withdraw(0, "10", { from: this.bob.address }) // block 220
      expect(await this.choc.totalSupply()).to.equal(
        ethers.utils.parseUnits("110", 18)
      )
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("100", 18)
      )
      expect(await this.choc.balanceOf(this.dev.address)).to.equal(
        ethers.utils.parseUnits("10", 18)
      )
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should distribute CHOCs properly for each staker", async function() {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "100"
      )
      await this.factory.deployed()
      await this.choc.transferOwnership(this.factory.address)
      await this.factory.add("100", this.lp.address, true)
      await this.lp.connect(this.alice).approve(this.factory.address, "1000", {
        from: this.alice.address,
      })
      await this.lp.connect(this.bob).approve(this.factory.address, "1000", {
        from: this.bob.address,
      })
      await this.lp.connect(this.carol).approve(this.factory.address, "1000", {
        from: this.carol.address,
      })
      // Alice deposits 10 LPs at block 310
      await time.advanceBlockTo("309")
      await this.factory
        .connect(this.alice)
        .deposit(0, "10", { from: this.alice.address })
      // Bob deposits 20 LPs at block 314
      await time.advanceBlockTo("313")
      await this.factory
        .connect(this.bob)
        .deposit(0, "20", { from: this.bob.address })
      // Carol deposits 30 LPs at block 318
      await time.advanceBlockTo("317")
      await this.factory
        .connect(this.carol)
        .deposit(0, "30", { from: this.carol.address })
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*10e18 + 4*1/3*10e18 + 2*1/6*10e18 = 56.666666666666666666
      //   ChocFactory should have the remaining: 10000 - 5666 = 43.333333333333333334
      await time.advanceBlockTo("319")
      await this.factory
        .connect(this.alice)
        .deposit(0, "10", { from: this.alice.address })
      expect(await this.choc.totalSupply()).to.equal(
        ethers.utils.parseUnits("110", 18)
      )
      expect(await this.choc.balanceOf(this.alice.address)).to.equal(
        ethers.utils.parseUnits("56.666666666666666666", 18)
      )
      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.choc.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.choc.balanceOf(this.factory.address)).to.equal(
        ethers.utils.parseUnits("43.333333333333333334", 18)
      )
      expect(await this.choc.balanceOf(this.dev.address)).to.equal(
        ethers.utils.parseUnits("10", 18)
      )
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*10e18 + 2*2/6*10e18 + 10*2/7*10e18 = 6190
      await time.advanceBlockTo("329")
      await this.factory
        .connect(this.bob)
        .withdraw(0, "5", { from: this.bob.address })
      expect(await this.choc.totalSupply()).to.equal(
        ethers.utils.parseUnits("220", 18)
      )
      expect(await this.choc.balanceOf(this.alice.address)).to.equal(
        ethers.utils.parseUnits("56.666666666666666666", 18)
      )
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("61.904761904761904761", 18)
      )
      expect(await this.choc.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.choc.balanceOf(this.factory.address)).to.equal(
        ethers.utils.parseUnits("81.428571428571428573", 18)
      )
      expect(await this.choc.balanceOf(this.dev.address)).to.equal(
        ethers.utils.parseUnits("20", 18)
      )
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await time.advanceBlockTo("339")
      await this.factory
        .connect(this.alice)
        .withdraw(0, "20", { from: this.alice.address })
      await time.advanceBlockTo("349")
      await this.factory
        .connect(this.bob)
        .withdraw(0, "15", { from: this.bob.address })
      await time.advanceBlockTo("359")
      await this.factory
        .connect(this.carol)
        .withdraw(0, "30", { from: this.carol.address })
      expect(await this.choc.totalSupply()).to.equal(
        ethers.utils.parseUnits("550", 18)
      )
      expect(await this.choc.balanceOf(this.dev.address)).to.equal(
        ethers.utils.parseUnits("50", 18)
      )
      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await this.choc.balanceOf(this.alice.address)).to.equal(
        ethers.utils.parseUnits("116.007326007326007325", 18)
      )
      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("118.315018315018315017", 18)
      )
      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await this.choc.balanceOf(this.carol.address)).to.equal(
        ethers.utils.parseUnits("265.677655677655677656", 18)
      )
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper CHOCs allocation to each pool", async function() {
      // 100 per block farming rate starting at block 400 with bonus until block 1000
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "100"
      )
      await this.choc.transferOwnership(this.factory.address)
      await this.lp
        .connect(this.alice)
        .approve(this.factory.address, "1000", { from: this.alice.address })

      await this.lp2
        .connect(this.bob)
        .approve(this.factory.address, "1000", { from: this.bob.address })
      // Add first LP to the pool with allocation 1
      await this.factory.add("10", this.lp.address, true)
      // Alice deposits 10 LPs at block 410
      await time.advanceBlockTo("409")
      await this.factory
        .connect(this.alice)
        .deposit(0, "10", { from: this.alice.address })
      // Add LP2 to the pool with allocation 2 at block 420
      await time.advanceBlockTo("419")
      await this.factory.add("20", this.lp2.address, true)
      // Alice should have 10*10e18 pending reward
      expect(await this.factory.pendingChoc(0, this.alice.address)).to.equal(
        ethers.utils.parseUnits("100", 18)
      )
      // Bob deposits 5 LP2s at block 425
      await time.advanceBlockTo("424")
      await this.factory
        .connect(this.bob)
        .deposit(1, "5", { from: this.bob.address })
      // Alice should have 10e18 + 5*1/3*10e18  pending reward
      expect(await this.factory.pendingChoc(0, this.alice.address)).to.equal(
        ethers.utils.parseUnits("116.666666666666666666", 18)
      )
      await time.advanceBlockTo("430")
      // At block 430. Bob should get 5*2/3*1318. Alice should get ~1666 more.
      expect(await this.factory.pendingChoc(0, this.alice.address)).to.equal(
        ethers.utils.parseUnits("133.333333333333333333", 18)
      )
      expect(await this.factory.pendingChoc(1, this.bob.address)).to.equal(
        ethers.utils.parseUnits("33.333333333333333333", 18)
      )
    })

    it("should decrease inflation rate upon update accurately", async function() {
      // starting with default inflation rate of 10000 (10.0 CHOC per block)
      this.factory = await this.ChocFactory.deploy(
        this.choc.address,
        this.dev.address,
        "100"
      )
      await this.factory.deployed()

      await this.choc.transferOwnership(this.factory.address)
      await this.factory.transferOwnership(this.dev.address)

      await this.factory.connect(this.dev).add("100", this.lp.address, true)

      await this.lp
        .connect(this.bob)
        .approve(this.factory.address, "1000", { from: this.bob.address })

      await time.advanceBlockTo("449")

      // *** First Round ***
      await this.factory
        .connect(this.bob)
        .deposit(0, "10", { from: this.bob.address }) // block 450

      expect(await this.factory.totalAllocPoint()).to.equal("100")

      expect(await this.choc.balanceOf(this.bob.address)).to.equal("0")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")

      await time.advanceBlockTo("454")

      await this.factory
        .connect(this.bob)
        .withdraw(0, "10", { from: this.bob.address }) // block 455

      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("50", 18)
      )
      await time.advanceBlockTo("469")
      // increase the inflation rate from 10000 to 20000 from block 570
      await this.factory.connect(this.dev).adjustEconomy("570", 20000)

      await time.advanceBlockTo("499")

      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal("0")

      // *** Second Round ***
      await this.factory
        .connect(this.bob)
        .deposit(0, "10", { from: this.bob.address }) // block 500

      await time.advanceBlockTo("504")

      // even though inflation rate is increased, it shouldn't be applied until block 570
      await this.factory
        .connect(this.bob)
        .withdraw(0, "10", { from: this.bob.address }) // block 505

      // Harvest should be (10 * 5) + (10 * 5) = 100
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("100", 18)
      )

      await time.advanceBlockTo("566")

      // *** Third Round ***
      await this.factory
        .connect(this.bob)
        .deposit(0, "10", { from: this.bob.address }) // block 567
      await time.advanceBlockTo("568")
      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal(
        ethers.utils.parseUnits("10", 18)
      )
      await time.advanceBlockTo("569")
      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal(
        ethers.utils.parseUnits("20", 18)
      )
      await time.advanceBlockTo("570") // not yet!
      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal(
        ethers.utils.parseUnits("30", 18)
      )
      // from here inflation should take place and incrase the rate
      await time.advanceBlockTo("571")
      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal(
        ethers.utils.parseUnits("50", 18)
      )
      await time.advanceBlockTo("579")

      await this.factory
        .connect(this.bob)
        .withdraw(0, "10", { from: this.bob.address }) // block 580

      // Pay attention that we have 100 CHOCs from previous rounds
      // 100 + ((570 - 567) * 10) + ((580 - 570) * 20) = 100 + 230 = 330
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("330", 18)
      )

      // let's do another round to make sure it works also after pool update
      await time.advanceBlockTo("584")
      // *** 4th Round ***
      await this.factory
        .connect(this.bob)
        .deposit(0, "10", { from: this.bob.address }) // block 585
      await time.advanceBlockTo("586")
      expect(await this.factory.pendingChoc(0, this.bob.address)).to.equal(
        ethers.utils.parseUnits("20", 18)
      )
      await time.advanceBlockTo("589")
      await this.factory
        .connect(this.bob)
        .deposit(0, "0", { from: this.bob.address }) // block 590

      // 330 + (590 - 585) * 20 = 430
      expect(await this.choc.balanceOf(this.bob.address)).to.equal(
        ethers.utils.parseUnits("430", 18)
      )
    })
  })
})
