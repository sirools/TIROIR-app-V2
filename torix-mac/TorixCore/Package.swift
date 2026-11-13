// swift-tools-version: 6.2
import PackageDescription

// Le cœur de Torix, commun au Mac et à l'iPhone.
// - TorixCore : cerveau, conversation, archive, outils, voix. Aucune interface.
// - TorixUI   : les vues SwiftUI communes (flamme, carte stellaire, cartes d'éléments).
let package = Package(
    name: "TorixCore",
    defaultLocalization: "fr",
    platforms: [
        .macOS(.v26),
        .iOS(.v26),
    ],
    products: [
        .library(name: "TorixCore", targets: ["TorixCore"]),
        .library(name: "TorixUI", targets: ["TorixUI"]),
    ],
    targets: [
        .target(
            name: "TorixCore",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .target(
            name: "TorixUI",
            dependencies: ["TorixCore"],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .testTarget(
            name: "TorixCoreTests",
            dependencies: ["TorixCore"],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
