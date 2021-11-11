module.exports = async function({ ethers, getNamedAccounts, deployments }) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const chainId = await getChainId()

  const wbch = await ethers.getContract("WBCH")

  const factoryAddress = (await deployments.get("UniswapV2Factory")).address

  await deploy("UniswapV2Router02", {
    from: deployer,
    args: [factoryAddress, wbch.address],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["UniswapV2Router02", "AMM"]
module.exports.dependencies = ["UniswapV2Factory", "Mocks"]
