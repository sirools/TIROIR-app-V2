// Lie le SDK Firebase (Swift Package Manager) à la cible de l'app iOS.
//
// Le module local modules/tiroir-hybrid-ai est une bibliothèque statique :
// son podspec déclare les mêmes produits pour pouvoir les importer, mais
// c'est l'app qui doit les lier. Firebase pour Apple n'est plus publié sur
// CocoaPods depuis la version 13, d'où ce passage par SPM.
// Branché par app.config.js, dans le build hackathon seulement.
const { withXcodeProject } = require('expo/config-plugins')

const URL = 'https://github.com/firebase/firebase-ios-sdk.git'
const NAME = 'firebase-ios-sdk'

function withFirebaseSpm(config, { minimumVersion, products }) {
  return withXcodeProject(config, cfg => {
    const project = cfg.modResults
    const objects = project.hash.project.objects
    const packageComment = `XCRemoteSwiftPackageReference "${NAME}"`

    objects.XCRemoteSwiftPackageReference ??= {}
    const already = Object.values(objects.XCRemoteSwiftPackageReference)
      .some(ref => typeof ref === 'object' && ref.repositoryURL?.includes(NAME))
    if (already) return cfg

    const packageId = project.generateUuid()
    objects.XCRemoteSwiftPackageReference[packageId] = {
      isa: 'XCRemoteSwiftPackageReference',
      repositoryURL: `"${URL}"`,
      requirement: { kind: 'upToNextMajorVersion', minimumVersion },
    }
    objects.XCRemoteSwiftPackageReference[`${packageId}_comment`] = packageComment

    const root = project.getFirstProject().firstProject
    root.packageReferences ??= []
    root.packageReferences.push({ value: packageId, comment: packageComment })

    const target = project.getFirstTarget()
    const nativeTarget = objects.PBXNativeTarget[target.uuid]
    nativeTarget.packageProductDependencies ??= []
    const frameworks = project.pbxFrameworksBuildPhaseObj(target.uuid)
    objects.XCSwiftPackageProductDependency ??= {}

    for (const product of products) {
      const productId = project.generateUuid()
      objects.XCSwiftPackageProductDependency[productId] = {
        isa: 'XCSwiftPackageProductDependency',
        package: packageId,
        package_comment: packageComment,
        productName: product,
      }
      objects.XCSwiftPackageProductDependency[`${productId}_comment`] = product
      nativeTarget.packageProductDependencies.push({ value: productId, comment: product })

      const buildFileId = project.generateUuid()
      objects.PBXBuildFile[buildFileId] = { isa: 'PBXBuildFile', productRef: productId, productRef_comment: product }
      objects.PBXBuildFile[`${buildFileId}_comment`] = `${product} in Frameworks`
      frameworks.files.push({ value: buildFileId, comment: `${product} in Frameworks` })
    }
    return cfg
  })
}

module.exports = withFirebaseSpm
