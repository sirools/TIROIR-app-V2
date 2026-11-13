import XCTest
@testable import TorixCore

final class ArchiveTests: XCTestCase {
    private let index = SampleArchive.index

    private func ids(_ query: ArchiveQuery) -> [String] {
        ArchiveSearch.run(query, items: index.elements, alias: index.alias).map(\.id)
    }

    func testExempleSixElements() throws {
        let decoded = try JSONDecoder().decode(ArchiveIndex.self, from: SampleArchive.encodedIndex())
        XCTAssertEqual(decoded.elements.count, 6)
        XCTAssertEqual(decoded.alias["papa"], "Denis")
        XCTAssertTrue(decoded.elements.allSatisfy { $0.titre.contains("exemple") })
    }

    func testQuestionDuBrief() {
        XCTAssertEqual(ids(ArchiveQuery(query: "Qu'est-ce que papa jouait en 1976 ?")),
                       ["exemple-denis-1976-ballade", "exemple-denis-1976-blues"])
    }

    func testArgumentsDuModele() {
        XCTAssertEqual(ids(ArchiveQuery(query: "musique", person: "papa", yearFrom: 1976, yearTo: 1976, type: "musique")),
                       ["exemple-denis-1976-ballade", "exemple-denis-1976-blues"])
        // Le modèle met parfois 0 ou une chaîne vide pour « rien ».
        XCTAssertEqual(ids(ArchiveQuery(query: "papa jouait", person: "", yearFrom: 1976, yearTo: 0, type: "")),
                       ["exemple-denis-1976-ballade", "exemple-denis-1976-blues"])
    }

    func testOrgueEtPhotos() {
        XCTAssertEqual(ids(ArchiveQuery(query: "orgue de Paul Muller")),
                       ["exemple-paul-1982-toccata", "exemple-paul-1991-choral"])
        XCTAssertEqual(ids(ArchiveQuery(query: "photos de Noël")).first, "exemple-photo-2011-noel")
    }

    func testRienTrouve() {
        XCTAssertEqual(ids(ArchiveQuery(query: "vacances en Bretagne")), [])
        XCTAssertEqual(ids(ArchiveQuery(query: "papa", yearFrom: 1950, yearTo: 1960)), [])
    }

    func testIndexEnSimpleTableau() throws {
        let bare = try JSONDecoder().decode(ArchiveIndex.self, from: Data(#"[{"id":"x","titre":"T","type":"Photos"}]"#.utf8))
        XCTAssertEqual(bare.elements.first?.type, .photo)
    }

    func testImportMetLAncienneArchiveDeCote() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("torix-import-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: root) }
        let source = root.appendingPathComponent("Source")
        let destination = root.appendingPathComponent("Documents/Archive")
        try fm.createDirectory(at: source.appendingPathComponent("Musique"), withIntermediateDirectories: true)
        try fm.createDirectory(at: destination, withIntermediateDirectories: true)
        try Data("ancien".utf8).write(to: destination.appendingPathComponent("ancien.txt"))

        // Sans index.json : refusé, et l'archive actuelle ne bouge pas.
        XCTAssertThrowsError(try ArchiveImporter.importFolder(from: source, to: destination))
        XCTAssertTrue(fm.fileExists(atPath: destination.appendingPathComponent("ancien.txt").path))

        try Data(#"[{"id":"a","titre":"Vrai souvenir","type":"musique","annee":1980}]"#.utf8)
            .write(to: source.appendingPathComponent("index.json"))
        try Data("son".utf8).write(to: source.appendingPathComponent("Musique/a.m4a"))

        let backup = try XCTUnwrap(try ArchiveImporter.importFolder(from: source, to: destination))
        XCTAssertTrue(fm.fileExists(atPath: destination.appendingPathComponent("index.json").path))
        XCTAssertTrue(fm.fileExists(atPath: destination.appendingPathComponent("Musique/a.m4a").path))
        XCTAssertFalse(fm.fileExists(atPath: destination.appendingPathComponent("ancien.txt").path))
        XCTAssertTrue(fm.fileExists(atPath: backup.appendingPathComponent("ancien.txt").path))
        // Le dossier d'origine n'est pas touché.
        XCTAssertTrue(fm.fileExists(atPath: source.appendingPathComponent("index.json").path))
    }
}
