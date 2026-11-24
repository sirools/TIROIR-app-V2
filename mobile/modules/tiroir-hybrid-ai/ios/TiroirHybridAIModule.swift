// Brique d'IA hybride de Tiroir, côté iOS.
//
//   Sur l'appareil  Vision d'Apple lit la photo (étiquettes, texte), puis le
//                   modèle embarqué d'Apple (Foundation Models) rédige la fiche.
//   Dans le cloud   Gemini, par Firebase AI Logic, avec la photo. Sur iOS 27,
//                   Gemini est branché sur la même `LanguageModelSession` que le
//                   modèle embarqué (`ai.geminiLanguageModel`) ; avant, par
//                   l'API `generateContent` de Firebase AI Logic.
//
// La bascule appareil → cloud se décide en TypeScript
// (mobile/src/services/hybridAI/ios.ts) ; ce fichier n'expose que les briques.
// Firebase n'est compilé que dans le build hackathon (voir le podspec).
import ExpoModulesCore
import UIKit
import Vision

#if canImport(FoundationModels)
  import FoundationModels
#endif

#if canImport(FirebaseAILogic)
  import FirebaseAILogic
  import FirebaseAppCheck
  import FirebaseCore
#endif

struct FirebaseConfigRecord: Record {
  @Field var apiKey: String = ""
  @Field var projectId: String = ""
  @Field var appId: String = ""
  @Field var messagingSenderId: String = ""
  @Field var appCheckDebug: Bool = false
}

public final class TiroirHybridAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TiroirHybridAI")

    Function("hasFirebase") { () -> Bool in
      #if canImport(FirebaseAILogic)
        return true
      #else
        return false
      #endif
    }

    Function("configure") { (config: FirebaseConfigRecord) in
      try HybridAIEngine.configure(config)
    }

    Function("appCheckDebugToken") { () -> String? in
      HybridAIEngine.appCheckDebugToken()
    }

    AsyncFunction("onDeviceStatus") { () async -> [String: String] in
      HybridAIEngine.onDeviceStatus()
    }

    AsyncFunction("observePhoto") { (base64: String) async throws -> [String: [String]] in
      try HybridAIEngine.observe(base64: base64)
    }

    AsyncFunction("quickCardOnDevice") { (prompt: String) async throws -> [String: String] in
      try await HybridAIEngine.quickCardOnDevice(prompt: prompt)
    }

    AsyncFunction("generateInCloud") { (kind: String, prompt: String, base64: String, model: String) async throws -> [String: String] in
      try await HybridAIEngine.generateInCloud(kind: kind, prompt: prompt, base64: base64, modelName: model)
    }
  }
}

// MARK: - Sorties structurées (génération guidée d'Apple)

#if canImport(FoundationModels)
  @available(iOS 26.0, *)
  @Generable(description: "A short inventory card for one object")
  struct QuickCardOutput {
    @Guide(description: "The object, 2 to 6 words, no trailing period")
    var name: String

    @Guide(description: "The category of the object, one or two words")
    var category: String

    @Guide(description: "One sentence, 25 words at most, describing the object")
    var summary: String
  }

  @available(iOS 26.0, *)
  @Generable(description: "A detailed inventory card with a second-hand price range in euros")
  struct EnrichmentOutput {
    @Guide(description: "3 to 5 sentences: material, condition, distinctive marks, period or model")
    var detailedDescription: String

    @Guide(description: "Low end of the second-hand price range in euros, 0 if it cannot be valued")
    var valueLow: Double

    @Guide(description: "High end of the second-hand price range in euros, 0 if it cannot be valued")
    var valueHigh: Double

    @Guide(description: "One sentence explaining what drives the price")
    var valueNote: String
  }
#endif

// MARK: - Moteur

enum HybridAIEngine {
  static let onDeviceModelName = "apple-foundation-models"

  static func fail(_ name: String, _ description: String) -> Exception {
    Exception(name: name, description: description)
  }

  static func json(_ object: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: object)
    return String(decoding: data, as: UTF8.self)
  }

  static func image(base64: String) throws -> UIImage {
    guard let data = Data(base64Encoded: base64), let image = UIImage(data: data) else {
      throw fail("ERR_HYBRID_AI_IMAGE", "Photo illisible")
    }
    return image
  }

  // MARK: Firebase et App Check

  static func configure(_ config: FirebaseConfigRecord) throws {
    #if canImport(FirebaseAILogic)
      if FirebaseApp.app() != nil { return }
      guard !config.apiKey.isEmpty, !config.projectId.isEmpty, !config.appId.isEmpty else {
        throw fail("ERR_HYBRID_AI_CONFIG", "Firebase non configuré : voir mobile/.env.example")
      }
      // App Check se règle avant la configuration de Firebase.
      if config.appCheckDebug {
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
      } else {
        AppCheck.setAppCheckProviderFactory(DeviceCheckProviderFactory())
      }
      let options = FirebaseOptions(googleAppID: config.appId, gcmSenderID: config.messagingSenderId)
      options.apiKey = config.apiKey
      options.projectID = config.projectId
      FirebaseApp.configure(options: options)
    #else
      throw fail("ERR_HYBRID_AI_NO_FIREBASE", "Ce build ne contient pas Firebase (drapeau hackathon absent)")
    #endif
  }

  static func appCheckDebugToken() -> String? {
    #if canImport(FirebaseAILogic)
      guard let app = FirebaseApp.app() else { return nil }
      return AppCheckDebugProvider(app: app)?.localDebugToken()
    #else
      return nil
    #endif
  }

  // MARK: Modèle embarqué d'Apple

  static func onDeviceStatus() -> [String: String] {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return ["status": "available", "reason": ""]
        case let .unavailable(reason):
          switch reason {
          case .modelNotReady:
            return ["status": "downloading", "reason": "modelNotReady"]
          case .appleIntelligenceNotEnabled:
            return ["status": "unavailable", "reason": "appleIntelligenceNotEnabled"]
          case .deviceNotEligible:
            return ["status": "unavailable", "reason": "deviceNotEligible"]
          @unknown default:
            return ["status": "unavailable", "reason": "unknown"]
          }
        }
      }
    #endif
    return ["status": "unavailable", "reason": "osTooOld"]
  }

  static func quickCardOnDevice(prompt: String) async throws -> [String: String] {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let session = LanguageModelSession(model: SystemLanguageModel.default)
        let response = try await session.respond(to: prompt, generating: QuickCardOutput.self)
        let card = response.content
        return [
          "json": try json(["name": card.name, "category": card.category, "description": card.summary]),
          "model": onDeviceModelName,
        ]
      }
    #endif
    throw fail("ERR_HYBRID_AI_NO_DEVICE_MODEL", "Modèle embarqué indisponible sur cet appareil")
  }

  // MARK: Vision d'Apple (sur l'appareil, sans modèle de langage)

  static func observe(base64: String) throws -> [String: [String]] {
    guard let cgImage = try image(base64: base64).cgImage else {
      throw fail("ERR_HYBRID_AI_IMAGE", "Photo illisible")
    }
    let classify = VNClassifyImageRequest()
    let readText = VNRecognizeTextRequest()
    readText.recognitionLevel = .accurate
    readText.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([classify, readText])

    let labels = (classify.results ?? [])
      .filter { $0.confidence >= 0.15 }
      .prefix(8)
      .map { $0.identifier.replacingOccurrences(of: "_", with: " ") }
    let texts = (readText.results ?? [])
      .compactMap { $0.topCandidates(1).first }
      .filter { $0.confidence >= 0.5 }
      .prefix(8)
      .map { $0.string }
    return ["labels": Array(labels), "texts": Array(texts)]
  }

  // MARK: Gemini dans le cloud, par Firebase AI Logic

  static func generateInCloud(kind: String, prompt: String, base64: String,
                              modelName: String) async throws -> [String: String] {
    #if canImport(FirebaseAILogic)
      guard FirebaseApp.app() != nil else {
        throw fail("ERR_HYBRID_AI_CONFIG", "Firebase non configuré")
      }
      let photo = try image(base64: base64)
      let ai = FirebaseAI.firebaseAI(backend: .googleAI())

      // iOS 27 : Gemini derrière l'API Foundation Models d'Apple — la même
      // session que le modèle embarqué, seul le modèle change.
      #if compiler(>=6.4) && canImport(FoundationModels)
        if #available(iOS 27.0, *), let cgImage = photo.cgImage {
          let session = LanguageModelSession(model: ai.geminiLanguageModel(name: modelName))
          if kind == "enrich" {
            let response = try await session.respond(generating: EnrichmentOutput.self) {
              prompt
              Attachment(cgImage)
            }
            let out = response.content
            return [
              "json": try json([
                "detailedDescription": out.detailedDescription,
                "valueLow": out.valueLow,
                "valueHigh": out.valueHigh,
                "valueNote": out.valueNote,
              ]),
              "model": modelName,
            ]
          }
          let response = try await session.respond(generating: QuickCardOutput.self) {
            prompt
            Attachment(cgImage)
          }
          let card = response.content
          return [
            "json": try json(["name": card.name, "category": card.category, "description": card.summary]),
            "model": modelName,
          ]
        }
      #endif

      // Avant iOS 27 : l'API generateContent de Firebase AI Logic.
      let schema: Schema = kind == "enrich"
        ? .object(properties: [
          "detailedDescription": .string(),
          "valueLow": .double(),
          "valueHigh": .double(),
          "valueNote": .string(),
        ])
        : .object(properties: [
          "name": .string(),
          "category": .string(),
          "description": .string(),
        ])
      let model = ai.generativeModel(
        modelName: modelName,
        generationConfig: GenerationConfig(responseMIMEType: "application/json", responseSchema: schema)
      )
      let response = try await model.generateContent(photo, prompt)
      guard let text = response.text else {
        throw fail("ERR_HYBRID_AI_EMPTY", "Réponse vide du modèle")
      }
      return ["json": text, "model": modelName]
    #else
      throw fail("ERR_HYBRID_AI_NO_FIREBASE", "Ce build ne contient pas Firebase (drapeau hackathon absent)")
    #endif
  }
}
