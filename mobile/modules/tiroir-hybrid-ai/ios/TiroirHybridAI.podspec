require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Firebase n'est lié que dans le build hackathon. Sans le drapeau, le module
# se compile en coquille vide (aucune IA, aucune dépendance) : le build de
# production ne change pas.
hackathon = ENV['EXPO_PUBLIC_HACKATHON_BUILD'] == 'true'

Pod::Spec.new do |s|
  s.name           = 'TiroirHybridAI'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Tiroir'
  s.homepage       = 'https://tiroir.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: 'https://github.com/sirools/TIROIR-app-V2.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Le SDK Firebase pour Apple n'est plus publié sur CocoaPods depuis la
  # version 13 : il vient par Swift Package Manager (aide de React Native).
  # Les mêmes produits sont liés à l'app par plugins/withFirebaseSpm.js.
  if hackathon
    spm_dependency(s,
      url: 'https://github.com/firebase/firebase-ios-sdk.git',
      requirement: { kind: 'upToNextMajorVersion', minimumVersion: '13.2.0' },
      products: ['FirebaseCore', 'FirebaseAppCheck', 'FirebaseAILogic']
    )
  end
end
