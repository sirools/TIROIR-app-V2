// swift-tools-version: 5.9
// Les règles du jeu, sans RealityKit : `swift test` les vérifie sur le Mac.
// L'app elle-même se lance depuis SousSolEnglouti.xcodeproj.
import PackageDescription

let package = Package(
    name: "Jeu",
    targets: [
        .target(name: "Jeu", path: "Sources/Jeu"),
        .testTarget(name: "JeuTests", dependencies: ["Jeu"], path: "Tests/JeuTests"),
    ]
)
