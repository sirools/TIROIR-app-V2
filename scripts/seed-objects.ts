#!/usr/bin/env npx ts-node
/**
 * Usage:
 *   npx ts-node scripts/seed-objects.ts --theme brocante --email you@email.com --password yourpassword
 *   npx ts-node scripts/seed-objects.ts --theme vetements
 *   npx ts-node scripts/seed-objects.ts --list          (liste les thèmes disponibles)
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import https from 'https'

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_KEY ?? ''
const REPLICATE_API_TOKEN = process.env.REPLICATE_KEY ?? ''
const SUPABASE_URL = 'https://jsduaelevpwflvwhhhvx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZHVhZWxldnB3Zmx2d2hoaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDE4MDUsImV4cCI6MjA5NzcxNzgwNX0.uwmOIuO2CHUT_s6mtXbJPkAy5dQWu_b6uCUJm1XQc0U'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedObject {
  name: string
  description: string
  status: 'owned' | 'sold' | 'stored' | 'lent'
  market_value?: number
  purchase_price?: number
  purchase_year?: number
  attributes?: Record<string, string>
  tags?: string[]
  searchTerms?: string[]   // fallbacks Unsplash du plus précis au plus générique
}

interface Theme {
  label: string
  collectionName: string
  collectionEmoji: string
  collectionColor: string
  objects: SeedObject[]
}

// ─── Catalogues ───────────────────────────────────────────────────────────────

const THEMES: Record<string, Theme> = {

  brocante: {
    label: 'Meubles & objets de brocante',
    collectionName: 'Brocante',
    collectionEmoji: '🪑',
    collectionColor: '#F5EDD6',
    objects: [
      { name: 'Commode Louis-Philippe en noyer', description: 'Commode à 5 tiroirs en noyer massif, poignées en laiton doré, plateau marbré blanc, patine dorée d\'origine. Très bon état général, légères traces d\'usure sur le plateau.', status: 'owned', market_value: 680, purchase_price: 220, purchase_year: 2022, attributes: { Matière: 'Noyer massif', Époque: '1840-1880', Dimensions: '120 × 55 × 90 cm', Provenance: 'Brocante de Lyon' } },
      { name: 'Chaise Thonet n°14', description: 'Chaise Thonet modèle 14 en bois courbé, cannage d\'origine en parfait état, marquage sous la traversée arrière. Modèle emblématique produit à partir de 1859.', status: 'owned', market_value: 120, purchase_price: 35, purchase_year: 2023, attributes: { Marque: 'Thonet', Matière: 'Hêtre courbé', Époque: '1890-1920', État: 'Excellent' } },
      { name: 'Miroir biseauté en laiton repoussé', description: 'Grand miroir ovale avec cadre en laiton repoussé à motifs floraux, tain légèrement piqué ce qui lui donne du caractère, crochet d\'époque au dos.', status: 'owned', market_value: 340, purchase_price: 80, purchase_year: 2021, attributes: { Matière: 'Laiton repoussé', Époque: 'Art Nouveau', Dimensions: '90 × 60 cm' } },
      { name: 'Table de chevet Art déco en palissandre', searchTerms: ['art deco bedside table', 'vintage nightstand wood', 'antique side table'], description: 'Petite table de nuit en palissandre avec un tiroir et une tablette basse, pieds fuselés, tiroir avec poignée en bakélite noire.', status: 'owned', market_value: 190, purchase_price: 60, purchase_year: 2022, attributes: { Matière: 'Palissandre', Époque: 'Art déco (1925-1940)', Dimensions: '45 × 38 × 65 cm' } },
      { name: 'Lampe de bureau articulée Jielde', searchTerms: ['industrial desk lamp', 'articulated metal lamp', 'vintage workshop lamp'], description: 'Lampe industrielle Jielde 2 bras en acier laqué gris anthracite, joints parfaitement huilés, câble refait à neuf, douille E27. Made in France.', status: 'owned', market_value: 320, purchase_price: 95, purchase_year: 2023, attributes: { Marque: 'Jielde', Couleur: 'Gris anthracite', État: 'Restaurée', Origine: 'France' } },
      { name: 'Buffet bas Henri II en chêne', description: 'Buffet deux corps en chêne sculpté avec motifs Renaissance, deux portes avec panneaux sculptés de feuilles d\'acanthe, serrures d\'origine avec clés.', status: 'owned', market_value: 950, purchase_price: 280, purchase_year: 2020, attributes: { Matière: 'Chêne massif', Style: 'Henri II', Dimensions: '160 × 55 × 85 cm', Époque: '1880-1900' } },
      { name: 'Pendule de cheminée en marbre noir', description: 'Pendule de cheminée Empire en marbre noir belge, mouvement à sonnerie 8 jours révisé, colonnes en bronze doré, cadran en émail blanc.', status: 'owned', market_value: 480, purchase_price: 150, purchase_year: 2021, attributes: { Style: 'Empire', Matière: 'Marbre noir et bronze', Mouvement: '8 jours, sonnerie', Dimensions: '38 × 15 × 36 cm' } },
      { name: 'Fauteuil crapaud en velours bleu paon', description: 'Fauteuil crapaud entièrement retapissé en velours côtelé bleu paon, bois laqué noir, ressorts refaits, très confortable.', status: 'owned', market_value: 420, purchase_price: 140, purchase_year: 2022, attributes: { Tissu: 'Velours bleu paon', Époque: 'Napoléon III', État: 'Restauré', Dimensions: '75 × 70 × 85 cm' } },
      { name: 'Carafe en cristal de Baccarat', description: 'Carafe à vin en cristal taillé, panse à panneaux taillés en biseau, col torsadé, bouchon d\'origine. Marque Baccarat gravée sous la base.', status: 'owned', market_value: 240, purchase_price: 45, purchase_year: 2023, attributes: { Marque: 'Baccarat', Matière: 'Cristal', Contenance: '1L', État: 'Parfait' } },
      { name: 'Bureau cylindre en acajou', description: 'Bureau à cylindre en acajou avec 6 tiroirs latéraux et compartiments intérieurs, cylindre en lattes d\'acajou, tablette coulissante en cuir vert.', status: 'owned', market_value: 1400, purchase_price: 450, purchase_year: 2019, attributes: { Matière: 'Acajou massif', Époque: '1880-1900', Dimensions: '140 × 80 × 120 cm', Garnissage: 'Cuir vert' } },
      { name: 'Vase soliflore en opaline rose', description: 'Vase soliflore en opaline rose soufflée bouche, col effilé, base évasée. Opaline de Bohème, milieu XIXe siècle.', status: 'owned', market_value: 95, purchase_price: 18, purchase_year: 2023, attributes: { Matière: 'Opaline soufflée', Couleur: 'Rose', Époque: '1850-1870', Hauteur: '22 cm' } },
      { name: 'Étagère à corniche style Empire', searchTerms: ['antique wall shelf wood', 'empire style shelf', 'vintage wooden shelf'], description: 'Petite étagère murale Empire en acajou avec colonnettes et corniche à frise de perles, 3 tablettes, patine chaleureuse.', status: 'owned', market_value: 280, purchase_price: 75, purchase_year: 2022, attributes: { Style: 'Empire', Matière: 'Acajou', Dimensions: '80 × 20 × 90 cm' } },
      { name: 'Pot à tabac en grès de Beauvaisis', searchTerms: ['stoneware pot antique', 'ceramic tobacco jar', 'antique pottery jar'], description: 'Pot à tabac couvert en grès salé bleu-gris, décor incisé de feuilles de vigne, bouchon en bois tourné d\'origine.', status: 'owned', market_value: 65, purchase_price: 12, purchase_year: 2023, attributes: { Matière: 'Grès salé', Époque: 'XIXe siècle', Origine: 'Beauvais', Hauteur: '14 cm' } },
      { name: 'Sellette en acajou style Napoléon III', description: 'Sellette à colonne torsadée en acajou, plateau carré avec galerie en bronze, base tripode à roulettes de cuivre.', status: 'owned', market_value: 320, purchase_price: 90, purchase_year: 2021, attributes: { Style: 'Napoléon III', Matière: 'Acajou et bronze', Dimensions: '35 × 35 × 110 cm' } },
      { name: 'Machine à écrire Hermès 3000', searchTerms: ['Hermes typewriter', 'vintage portable typewriter', 'retro typewriter'], description: 'Machine à écrire portable Hermès 3000 en aluminium brossé, ruban neuf, tous les mécanismes fonctionnels, coffret d\'origine.', status: 'owned', market_value: 280, purchase_price: 55, purchase_year: 2022, attributes: { Marque: 'Hermès', Modèle: '3000', Année: '1965', État: 'Fonctionnelle' } },
      { name: 'Candélabre en bronze doré à 5 lumières', description: 'Paire de candélabres en bronze doré au feu, 5 bobèches par bras, fûts en colonne à chapiteaux corinthiens, époque Restauration.', status: 'owned', market_value: 680, purchase_price: 200, purchase_year: 2020, attributes: { Matière: 'Bronze doré', Époque: 'Restauration (1815-1830)', Hauteur: '65 cm', Luminosité: '5 bras' } },
      { name: 'Chaise longue Récamier en acajou', description: 'Chaise longue Récamier Empire en acajou, rembourrage retapissé en soie ivoire, pieds en sabre, têtière réglable.', status: 'owned', market_value: 1100, purchase_price: 380, purchase_year: 2019, attributes: { Style: 'Empire', Matière: 'Acajou et soie', Dimensions: '185 × 65 cm', État: 'Restaurée' } },
      { name: 'Bouillotte en étain avec robinet', description: 'Bouillotte chauffante en étain poli avec robinet en laiton, anse articulée, fond bombé, poinçon de maître sur le couvercle.', status: 'owned', market_value: 120, purchase_price: 25, purchase_year: 2023, attributes: { Matière: 'Étain', Époque: 'XIXe siècle', Capacité: '3L', État: 'Très bon' } },
      { name: 'Secrétaire à abattant en loupe de frêne', description: 'Secrétaire à abattant en loupe de frêne avec intérieur en acajou, 8 petits tiroirs et 3 compartiments, filets d\'ébène en marqueterie.', status: 'owned', market_value: 880, purchase_price: 260, purchase_year: 2021, attributes: { Matière: 'Loupe de frêne et acajou', Époque: '1800-1830', Dimensions: '90 × 45 × 145 cm' } },
      { name: 'Statuette en biscuit de Sèvres', description: 'Statuette représentant une bergère en biscuit de porcelaine non émaillé, base ovale, très légères éclats sous la base non visibles.', status: 'owned', market_value: 340, purchase_price: 80, purchase_year: 2022, attributes: { Manufacture: 'Sèvres', Matière: 'Biscuit de porcelaine', Époque: '1780-1820', Hauteur: '28 cm' } },
      { name: 'Table gigogne laquée noire (set de 3)', description: 'Set de 3 tables gigognes en laque noire, plateau avec motif floral peint à la main, pieds cambrés, style Chinoiserie.', status: 'owned', market_value: 260, purchase_price: 70, purchase_year: 2022, attributes: { Style: 'Chinoiserie', Matière: 'Laque noire', Époque: '1920-1940', Nombre: '3 tables' } },
      { name: 'Baromètre amiral en acajou', searchTerms: ['antique barometer wood', 'vintage mercury barometer', 'mahogany barometer'], description: 'Baromètre de marine en acajou avec tube de Torricelli d\'origine, échelle en laiton gravée, cuvette en corne.', status: 'owned', market_value: 480, purchase_price: 120, purchase_year: 2020, attributes: { Type: 'Baromètre amiral', Matière: 'Acajou et laiton', Époque: '1870-1900', Fonctionnement: 'Oui' } },
      { name: 'Tabouret de piano réglable en velours vert', description: 'Tabouret de piano réglable à vis en bois laqué noir, assise ronde retapissée en velours vert empire, croisillon en laiton.', status: 'owned', market_value: 180, purchase_price: 45, purchase_year: 2023, attributes: { Matière: 'Bois laqué et velours', Couleur: 'Vert empire', Réglage: 'À vis', Époque: '1900-1920' } },
      { name: 'Assiette en faïence de Quimper (lot de 6)', searchTerms: ['Quimper faience plate', 'french folk pottery plate', 'hand painted ceramic plate'], description: 'Lot de 6 assiettes plates en faïence de Quimper, décor folklorique breton peint à la main, dos avec marque Henriot Quimper.', status: 'owned', market_value: 210, purchase_price: 48, purchase_year: 2022, attributes: { Manufacture: 'Henriot Quimper', Matière: 'Faïence', Décor: 'Breton', Nombre: '6 assiettes' } },
      { name: 'Cadre baguette en bois doré (75 × 60 cm)', searchTerms: ['antique gold picture frame', 'ornate gilded frame', 'vintage golden frame'], description: 'Grand cadre vide en bois doré à la feuille, baguette à double rang de perles, coins à rosaces, dorure à 80% d\'origine.', status: 'owned', market_value: 220, purchase_price: 55, purchase_year: 2021, attributes: { Matière: 'Bois doré à la feuille', Dimensions: '75 × 60 cm (extérieur)', Style: 'Louis XVI', Époque: '1880-1920' } },
      { name: 'Écritoire de voyage en maroquin rouge', searchTerms: ['leather writing case antique', 'vintage travel writing box', 'leather desk set'], description: 'Écritoire de voyage en maroquin rouge estampé, intérieur en soie ivoire avec compartiments, porte-plume et encrier en verre inclus.', status: 'owned', market_value: 320, purchase_price: 85, purchase_year: 2022, attributes: { Matière: 'Maroquin et soie', Couleur: 'Rouge', Époque: '1880-1910', État: 'Très bon' } },
      { name: 'Semainier en ébène de Macassar', description: 'Semainier Art déco à 7 tiroirs en ébène de Macassar, poignées en chrome, structure en chêne plaqué, pieds droits gainés de cuivre.', status: 'owned', market_value: 1250, purchase_price: 400, purchase_year: 2020, attributes: { Matière: 'Ébène de Macassar', Style: 'Art déco', Dimensions: '55 × 40 × 120 cm', Époque: '1925-1935' } },
      { name: 'Théière en argent massif poinçonné', description: 'Théière en argent massif, panse piriforme, bec verseur en col de cygne, manche en ébène, poinçons Minerve et maître-orfèvre.', status: 'owned', market_value: 680, purchase_price: 200, purchase_year: 2021, attributes: { Matière: 'Argent massif 950', Poinçon: 'Minerve', Capacité: '1,2 L', Époque: '1890-1910' } },
      { name: 'Penderie de voyage en cuir fauve', description: 'Ancienne penderie de voyage en cuir fauve, ferrures en laiton, barre de suspension chromée, étiquettes de Grand Hôtel à l\'intérieur.', status: 'owned', market_value: 380, purchase_price: 95, purchase_year: 2022, attributes: { Matière: 'Cuir fauve et laiton', Époque: '1920-1940', Dimensions: '50 × 30 × 90 cm', Provenance: 'Grand Hôtel' } },
      { name: 'Applique murale en bronze Art Nouveau', description: 'Paire d\'appliques murales en bronze patiné, pétales de lys stylisés formant le diffuseur, câble refait, ampoule E14.', status: 'owned', market_value: 480, purchase_price: 130, purchase_year: 2021, attributes: { Style: 'Art Nouveau', Matière: 'Bronze patiné', Époque: '1900-1920', État: 'Restaurée' } },
      { name: 'Coffret à bijoux en marqueterie de paille', description: 'Coffret à bijoux rectangulaire en marqueterie de paille dorée et naturelle, intérieur en satin ivoire, miroir au couvercle, serrure dorée.', status: 'owned', market_value: 180, purchase_price: 40, purchase_year: 2023, attributes: { Matière: 'Marqueterie de paille', Époque: '1940-1950', Dimensions: '25 × 18 × 12 cm', Intérieur: 'Satin ivoire' } },
      { name: 'Chaise longue de jardin en teck', searchTerms: ['teak garden lounger', 'wooden deck chair', 'colonial garden chair'], description: 'Chaise longue de jardin coloniale en teck massif, lattes larges, dossier ajustable à 5 positions, accoudoirs plats.', status: 'owned', market_value: 420, purchase_price: 110, purchase_year: 2022, attributes: { Matière: 'Teck massif', Style: 'Colonial', Époque: '1920-1940', État: 'Très bon' } },
      { name: 'Télescope de marine en laiton', description: 'Longue-vue de marine à 3 tirants en laiton poli et cuir brun, optique parfaitement claire, grossissement 30x, longueur déployée 90 cm.', status: 'owned', market_value: 280, purchase_price: 65, purchase_year: 2021, attributes: { Matière: 'Laiton et cuir', Grossissement: '30x', Longueur: '90 cm déployé', Époque: '1900-1930' } },
      { name: 'Coiffeuse triptyque en bois de rose', description: 'Coiffeuse à 3 miroirs en bois de rose, plateau en marbre rose, 2 petits tiroirs latéraux, pieds cambrés, quincaillerie en bronze.', status: 'owned', market_value: 760, purchase_price: 220, purchase_year: 2020, attributes: { Matière: 'Bois de rose et marbre', Époque: 'Napoléon III', Dimensions: '120 × 55 × 155 cm' } },
      { name: 'Paire de chenets en fonte de Tubalcain', description: 'Paire de chenets en fonte à décor de lions héraldiques, crémaillère en fer forgé incluse, belle patine noire d\'origine.', status: 'owned', market_value: 240, purchase_price: 60, purchase_year: 2022, attributes: { Matière: 'Fonte et fer', Décor: 'Lions héraldiques', Époque: 'XIXe siècle', Hauteur: '30 cm' } },
      { name: 'Porte-manteau en bambou tourné', description: 'Porte-manteau sur pied en bambou naturel tourné, 8 crochets en laiton, base à 4 pieds en croix, style exotique colonial.', status: 'owned', market_value: 210, purchase_price: 50, purchase_year: 2023, attributes: { Matière: 'Bambou et laiton', Style: 'Colonial', Hauteur: '185 cm', Crochets: '8' } },
      { name: 'Plateau de service en argent plaqué Sheffield', searchTerms: ['silver serving tray antique', 'Sheffield silver plated tray', 'vintage butler tray'], description: 'Grand plateau ovale en argent plaqué Sheffield avec bords godronés et poignées ajourées, gravure centrale d\'armoiries.', status: 'owned', market_value: 160, purchase_price: 35, purchase_year: 2023, attributes: { Matière: 'Argent plaqué Sheffield', Dimensions: '55 × 38 cm', Époque: '1880-1910', Décor: 'Armoiries gravées' } },
      { name: 'Carnet de cuir de Harry Mintz Paris', searchTerms: ['leather notebook vintage', 'antique leather journal', 'handmade leather diary'], description: 'Carnet de notes en cuir brun grainé, reliure cousue à la main, pages vergé ivoire, fermoir en laiton, signet en soie rouge.', status: 'owned', market_value: 85, purchase_price: 20, purchase_year: 2022, attributes: { Fabricant: 'Harry Mintz Paris', Matière: 'Cuir grainé', Époque: '1950-1970', Dimensions: '15 × 10 cm' } },
      { name: 'Bahut renaissance en chêne sculpté', description: 'Bahut 2 portes en chêne sculpté à panneaux de médaillons Renaissance, galerie ajourée en crête, pieds carrés en gaine.', status: 'owned', market_value: 1800, purchase_price: 580, purchase_year: 2018, attributes: { Style: 'Renaissance', Matière: 'Chêne massif', Dimensions: '160 × 58 × 90 cm', Époque: '1860-1900' } },
      { name: 'Mannequin de couturière en toile de lin', description: 'Mannequin de couturière réglable en taille avec buste en toile de lin naturel, support en métal laqué noir, pied tripode en bois.', status: 'owned', market_value: 180, purchase_price: 45, purchase_year: 2023, attributes: { Type: 'Mannequin couturière', Matière: 'Toile de lin', Réglable: 'Oui (38-46)', Époque: '1940-1960' } },
      { name: 'Globe terrestre sur pied acajou', description: 'Globe terrestre géographique sur méridien en laiton et pied en acajou tourné, cartographie française datée de 1935, diamètre 32 cm.', status: 'owned', market_value: 520, purchase_price: 140, purchase_year: 2021, attributes: { Fabricant: 'Taride Paris', Diamètre: '32 cm', Année: '1935', Matière: 'Papier maché et acajou' } },
      { name: 'Fauteuil voltaire en tissu houndstooth', description: 'Fauteuil Voltaire en hêtre, retapissé en tissu pied-de-poule noir et blanc, rembourrage à ressorts ressauts, pieds tournés.', status: 'owned', market_value: 380, purchase_price: 100, purchase_year: 2022, attributes: { Tissu: 'Pied-de-poule noir et blanc', Époque: 'Napoléon III', État: 'Restauré', Dimensions: '80 × 85 × 100 cm' } },
      { name: 'Paire de vases balustre en porcelaine de Chine', searchTerms: ['chinese blue white porcelain vase', 'antique chinoiserie vase pair', 'oriental ceramic vase'], description: 'Paire de vases balustres en porcelaine de Chine à décor bleu et blanc de dragons, famille bleue de Kangxi, avec montures en bronze.', status: 'owned', market_value: 1600, purchase_price: 480, purchase_year: 2019, attributes: { Origine: 'Chine, période Kangxi', Décor: 'Bleu et blanc, dragons', Montures: 'Bronze doré', Hauteur: '55 cm' } },
      { name: 'Armoire bretonne en chêne polychrome', description: 'Armoire paysanne bretonne à deux portes en chêne, panneaux sculptés de motifs floraux peints en bleu et rouge, intérieur avec 2 étagères.', status: 'owned', market_value: 1100, purchase_price: 320, purchase_year: 2020, attributes: { Origine: 'Bretagne', Matière: 'Chêne polychrome', Époque: '1780-1830', Dimensions: '140 × 55 × 195 cm' } },
      { name: 'Montre de gousset Longines or 18K', searchTerms: ['gold pocket watch antique', 'Longines pocket watch', 'vintage pocket watch chain'], description: 'Montre de gousset Longines en boîtier or 18 carats, cadran émail blanc index romains, mouvement 17 rubis, chaîne en or jaune.', status: 'owned', market_value: 1400, purchase_price: 420, purchase_year: 2021, attributes: { Marque: 'Longines', Boîtier: 'Or 18K', Mouvement: '17 rubis', Époque: '1900-1920' } },
      { name: 'Chevet japonisant en laque noire et or', description: 'Table de chevet en bois laqué noir à décors dorés de branches de cerisier, tiroir unique, pied en sabots.', status: 'owned', market_value: 280, purchase_price: 75, purchase_year: 2022, attributes: { Style: 'Japonisant', Matière: 'Laque noire et or', Époque: '1880-1910', Dimensions: '40 × 35 × 72 cm' } },
      { name: 'Gramophone à pavillon La Voix de son Maître', description: 'Gramophone à pavillon en tôle peinte noir et or, boîte en acajou, plateau en métal, fonctionne avec moteur à ressort. Pavillon d\'origine complet.', status: 'owned', market_value: 850, purchase_price: 250, purchase_year: 2019, attributes: { Marque: 'La Voix de son Maître', Époque: '1910-1920', État: 'Fonctionnel', Pavillon: 'Original' } },
      { name: 'Tabatière en écaille et or poinçonné', description: 'Tabatière rectangulaire en écaille blonde montée en or 18K poinçonné, intérieur doré, charnière à ressort, monogramme gravé.', status: 'owned', market_value: 680, purchase_price: 180, purchase_year: 2021, attributes: { Matière: 'Écaille et or 18K', Poinçon: 'Minerve', Dimensions: '8 × 5 cm', Époque: '1870-1900' } },
      { name: 'Bureau Mazarin en marqueterie Boulle', searchTerms: ['boulle marquetry desk antique', 'louis XIV writing desk', 'ornate antique desk ebony'], description: 'Petit bureau Mazarin à 8 tiroirs en ébène et marqueterie Boulle (écaille et laiton), galerie en bronze ciselé, style Louis XIV.', status: 'owned', market_value: 3200, purchase_price: 980, purchase_year: 2018, attributes: { Style: 'Louis XIV', Technique: 'Marqueterie Boulle', Dimensions: '120 × 65 × 80 cm', Époque: '1880-1900' } },
      { name: 'Boîte à musique Reuge à 3 airs', description: 'Boîte à musique Reuge Sainte-Croix jouant 3 airs (Valse Viennoise, Für Elise, La Vie en Rose), boîtier en bois de ronce, mécanisme impeccable.', status: 'owned', market_value: 460, purchase_price: 130, purchase_year: 2022, attributes: { Marque: 'Reuge', Airs: '3 (Valse, Für Elise, Vie en Rose)', Boîtier: 'Bois de ronce', État: 'Parfait' } },
    ],
  },

  vetements: {
    label: 'Garde-robe vintage',
    collectionName: 'Garde-robe vintage',
    collectionEmoji: '👗',
    collectionColor: '#F0E8F5',
    objects: [
      { name: 'Veste en cuir Schott Perfecto', description: 'Veste de moto Schott Perfecto 618 en cuir de vachette noir, fermeture éclair YKK, épaulettes, ceinture ajustable.', status: 'owned', market_value: 450, purchase_price: 180, purchase_year: 2020, attributes: { Marque: 'Schott', Taille: 'M', Matière: 'Cuir vachette', Pays: 'USA' } },
      { name: 'Trench-coat Burberry Heritage', description: 'Trench-coat Burberry Heritage beige, doublure tartan Nova Check, ceinture et épaulettes, étiquette London.', status: 'owned', market_value: 680, purchase_price: 220, purchase_year: 2021, attributes: { Marque: 'Burberry', Taille: 'L', Couleur: 'Beige', Doublure: 'Tartan Nova Check' } },
      { name: 'Blouson bomber MA-1 Alpha Industries', description: 'Blouson bomber Alpha Industries MA-1 vert kaki réversible, intérieur orange safety, poches cargo.', status: 'owned', market_value: 180, purchase_price: 65, purchase_year: 2022, attributes: { Marque: 'Alpha Industries', Modèle: 'MA-1', Taille: 'M', Couleur: 'Kaki / orange' } },
      { name: 'Jean Levi\'s 501 vintage 1980', description: 'Jean Levi\'s 501 authentique années 80, coupe droite, délavage naturel, boutons en métal cuivré, label rouge.', status: 'owned', market_value: 220, purchase_price: 45, purchase_year: 2023, attributes: { Marque: "Levi's", Modèle: '501', Taille: 'W32 L34', Époque: 'Années 80' } },
      { name: 'Cardigan en cachemire Loro Piana', description: 'Cardigan en cachemire fin Loro Piana bleu marine, col V, 5 boutons nacrés, état quasi neuf.', status: 'owned', market_value: 580, purchase_price: 160, purchase_year: 2022, attributes: { Marque: 'Loro Piana', Matière: 'Cachemire 100%', Taille: 'M', Couleur: 'Bleu marine' } },
      { name: 'Mocassins Gucci Horsebit en cuir cognac', description: 'Mocassins Gucci avec mors en métal doré, cuir véritablement cognac, semelle en cuir, pointure 42.', status: 'owned', market_value: 420, purchase_price: 130, purchase_year: 2021, attributes: { Marque: 'Gucci', Modèle: 'Horsebit', Pointure: '42', Matière: 'Cuir cognac' } },
      { name: 'Chemise hawaïenne Aloha vintage 50s', description: 'Chemise hawaïenne en soie et rayonne, imprimé floral tropical multicolore, boutons en noix de coco, coupe boîte.', status: 'owned', market_value: 180, purchase_price: 35, purchase_year: 2023, attributes: { Style: 'Aloha', Matière: 'Soie et rayonne', Époque: 'Années 50', Taille: 'L' } },
      { name: 'Manteau en laine camel Céline Paris', description: 'Manteau droit en lainage camel Céline Paris, col tailleur, deux boutons recouverts, poches cavalières, doublure en soie.', status: 'owned', market_value: 780, purchase_price: 240, purchase_year: 2020, attributes: { Marque: 'Céline', Matière: 'Laine camel', Taille: '38', Doublure: 'Soie' } },
      { name: 'Sneakers Nike Air Max 90 OG', description: 'Nike Air Max 90 coloris infrared OG (blanc, gris, infrared), chaussure iconique de 1990, sole Air intact, état collector.', status: 'owned', market_value: 320, purchase_price: 95, purchase_year: 2021, attributes: { Marque: 'Nike', Modèle: 'Air Max 90', Pointure: '43', Coloris: 'OG Infrared' } },
      { name: 'Veste de costume Prince of Wales Huntsman', description: 'Veste de costume sur mesure Huntsman Savile Row, tissu Prince of Wales gris anthracite, doublure bleu roi, construction Bespoke.', status: 'owned', market_value: 1800, purchase_price: 550, purchase_year: 2019, attributes: { Tailleur: 'Huntsman Savile Row', Tissu: 'Prince of Wales', Taille: '48', Construction: 'Bespoke' } },
    ],
  },

  cuisine: {
    label: 'Équipement cuisine',
    collectionName: 'Cuisine',
    collectionEmoji: '🍳',
    collectionColor: '#FFF0E8',
    objects: [
      { name: 'Robot pâtissier KitchenAid Artisan', description: 'Robot pâtissier KitchenAid Artisan 4,8L rouge empire, batteur plat, crochet pétrisseur et fouet inclus, état impeccable.', status: 'owned', market_value: 380, purchase_price: 120, purchase_year: 2021, attributes: { Marque: 'KitchenAid', Modèle: 'Artisan', Capacité: '4,8L', Couleur: 'Rouge empire' } },
      { name: 'Couteau de chef Sabatier Thiers 20cm', description: 'Couteau de chef Sabatier Thiers forgé, lame acier inox 20cm, manche en buis, équilibre parfait. Affûté professionnellement.', status: 'owned', market_value: 120, purchase_price: 40, purchase_year: 2020, attributes: { Marque: 'Sabatier', Origine: 'Thiers', Longueur: '20cm', Manche: 'Buis' } },
      { name: 'Cafetière italienne Bialetti Moka Express 6 tasses', description: 'Moka Express Bialetti 6 tasses en aluminium poli, joint neuf, filtre propre, idéale pour café corsé.', status: 'owned', market_value: 45, purchase_price: 15, purchase_year: 2022, attributes: { Marque: 'Bialetti', Modèle: 'Moka Express', Capacité: '6 tasses', Matière: 'Aluminium' } },
      { name: 'Cocotte en fonte Le Creuset 28cm rouge', description: 'Cocotte ronde Le Creuset 28cm en fonte émaillée rouge cerise, couvercle avec bouton doré, intérieur crème.', status: 'owned', market_value: 280, purchase_price: 85, purchase_year: 2021, attributes: { Marque: 'Le Creuset', Diamètre: '28cm', Couleur: 'Rouge cerise', Matière: 'Fonte émaillée' } },
      { name: 'Balance de cuisine vintage Terraillon', description: 'Balance de cuisine mécanique Terraillon des années 70, plateau en inox, cadran jusqu\'à 2kg, graduation au 10g.', status: 'owned', market_value: 55, purchase_price: 12, purchase_year: 2023, attributes: { Marque: 'Terraillon', Époque: 'Années 70', Portée: '2kg', Graduation: '10g' } },
    ],
  },

  tournage: {
    label: 'Costumes & accessoires de tournage',
    collectionName: 'Tournage',
    collectionEmoji: '🎬',
    collectionColor: '#F0EAF8',
    objects: [
      {
        name: 'Veste en cuir noir oversize',
        description: 'Veste en cuir véritable noir, coupe oversize années 80, revers larges, deux poches poitrine à rabat, doublure bordeaux. Portée par le personnage principal dans les scènes nocturnes.',
        status: 'owned', market_value: 380, attributes: { Matière: 'Cuir véritable', Taille: 'M/L oversize', Couleur: 'Noir', Scènes: 'Extérieur nuit' },
        searchTerms: ['black leather oversize jacket product photo', 'leather jacket white background fashion'],
      },
      {
        name: 'Combinaison de travail bleue délavée',
        description: 'Combinaison une pièce en denim délavé, coupe droite, broderie "Garage Léon" au dos, taches d\'huile simulées. Costume de travail personnage secondaire.',
        status: 'owned', market_value: 95, attributes: { Matière: 'Denim', Taille: 'L', Couleur: 'Bleu délavé', Personnage: 'Léon' },
        searchTerms: ['denim work overalls product photo white background', 'blue coveralls workwear'],
      },
      {
        name: 'Robe de soirée rouge sang dos nu',
        description: 'Robe longue en crêpe de soie rouge profond, dos nu jusqu\'à la taille, bretelles fines, fente latérale. Scène du bal – personnage Camille.',
        status: 'owned', market_value: 650, attributes: { Matière: 'Crêpe de soie', Taille: 'S', Couleur: 'Rouge sang', Personnage: 'Camille' },
        searchTerms: ['red backless evening gown product photo', 'red silk dress white background fashion editorial'],
      },
      {
        name: 'Manteau en laine camel col châle',
        description: 'Manteau long double boutonnage en laine camel, col châle, ceinture assortie, doublure en satin ivoire. Personnage detective, scènes d\'intérieur.',
        status: 'owned', market_value: 420, attributes: { Matière: 'Laine', Taille: 'M', Couleur: 'Camel', Style: 'Années 40' },
        searchTerms: ['camel wool coat product photo white background', 'classic overcoat fashion editorial neutral background'],
      },
      {
        name: 'Costume 3 pièces gris anthracite rayé',
        description: 'Costume trois pièces en laine gris anthracite à fines rayures blanches, veste croisée, gilet 5 boutons, pantalon à pli. Personnage du patron.',
        status: 'owned', market_value: 890, attributes: { Matière: 'Laine', Taille: '48', Couleur: 'Gris anthracite', Coupe: 'Croisé' },
        searchTerms: ['grey pinstripe suit product photo', 'three piece suit white background fashion'],
      },
      {
        name: 'Trench-coat beige vintage Burberry',
        description: 'Trench-coat beige classique, double boutonnage, épaulettes, ceinture D-ring, doublure tartan. Modèle années 70. Personnage journaliste.',
        status: 'owned', market_value: 340, attributes: { Matière: 'Gabardine', Taille: 'M', Couleur: 'Beige', Époque: 'Années 70' },
        searchTerms: ['beige trench coat product photo neutral background', 'classic trench coat fashion editorial'],
      },
      {
        name: 'Blouson aviateur A-2 en cuir brun',
        description: 'Blouson aviateur modèle A-2 en cuir brun havane, col en fourrure synthétique, patches militaires cousus, intérieur laine beige. Personnage pilote.',
        status: 'owned', market_value: 290, attributes: { Matière: 'Cuir', Taille: 'L', Couleur: 'Brun havane', Style: 'Militaire WWII' },
        searchTerms: ['A2 leather flight jacket brown product photo', 'aviator jacket military white background'],
      },
      {
        name: 'Robe chemise en lin blanc cassé',
        description: 'Robe chemise midi en lin froissé blanc cassé, col officier, manches roulées, ceinture en raphia. Scènes d\'été, personnage artiste.',
        status: 'owned', market_value: 145, attributes: { Matière: 'Lin', Taille: 'M', Couleur: 'Blanc cassé', Saison: 'Été' },
        searchTerms: ['linen shirt dress off white product photo', 'white linen dress neutral background fashion'],
      },
      {
        name: 'Pull irlandais Aran en laine écrue',
        description: 'Pull irlandais à torsades Aran en pure laine vierge écrue, col roulé large, coupe ample. Personnage pêcheur, scènes côtières.',
        status: 'owned', market_value: 185, attributes: { Matière: 'Laine vierge', Taille: 'L', Couleur: 'Écru', Tricot: 'Aran' },
        searchTerms: ['Aran knit sweater white background product photo', 'cable knit wool jumper fashion editorial'],
      },
      {
        name: 'Salopette en velours côtelé bordeaux',
        description: 'Salopette à bretelles en velours côtelé bordeaux, poches cargo sur les jambes, boutons dorés. Personnage adolescent années 90.',
        status: 'owned', market_value: 120, attributes: { Matière: 'Velours côtelé', Taille: 'S', Couleur: 'Bordeaux', Époque: 'Années 90' },
        searchTerms: ['burgundy corduroy overalls product photo', 'velvet dungarees white background fashion'],
      },
      {
        name: 'Imperméable en PVC transparent irisé',
        description: 'Imperméable long en PVC transparent avec reflets irisés, boutons-pression, poches plaquées. Scène de pluie – personnage futuriste.',
        status: 'owned', market_value: 210, attributes: { Matière: 'PVC', Taille: 'M', Couleur: 'Transparent irisé', Style: 'Futuriste' },
        searchTerms: ['iridescent transparent PVC raincoat product photo', 'clear vinyl coat fashion editorial white background'],
      },
      {
        name: 'Veste tailleur en tweed rose poudré',
        description: 'Veste tailleur courte en tweed fantaisie rose poudré et fil doré, col Chanel, boutons nacrés. Personnage bourgeoise parisienne.',
        status: 'owned', market_value: 480, attributes: { Matière: 'Tweed', Taille: 'S', Couleur: 'Rose poudré', Style: 'Chanel' },
        searchTerms: ['pink tweed blazer product photo white background', 'Chanel style jacket fashion editorial neutral'],
      },
      {
        name: 'Jean brut selvedge indigo 501',
        description: 'Jean droit brut en denim selvedge japonais indigo 14oz, coutures oranges, patch en cuir, non lavé. Personnage mécano.',
        status: 'owned', market_value: 220, attributes: { Matière: 'Denim selvedge', Taille: '32/32', Couleur: 'Indigo brut', Poids: '14oz' },
        searchTerms: ['raw selvedge denim jeans product photo white background', 'indigo jeans fashion editorial neutral background'],
      },
      {
        name: 'Kimono en soie brodée dragons dorés',
        description: 'Kimono long en soie noire brodée de dragons dorés, ceinture obi assortie, manches papillon. Scène du banquet – personnage mystérieux.',
        status: 'owned', market_value: 750, attributes: { Matière: 'Soie brodée', Taille: 'Unique', Couleur: 'Noir et or', Motif: 'Dragons' },
        searchTerms: ['black silk kimono gold embroidery product photo', 'dragon embroidered robe fashion editorial white background'],
      },
      {
        name: 'Robe chasuble en velours émeraude',
        description: 'Robe chasuble sans manches en velours ras émeraude, col en V, ourlet au genou, fermeture dorsale. Personnage assistante.',
        status: 'owned', market_value: 195, attributes: { Matière: 'Velours ras', Taille: 'M', Couleur: 'Émeraude', Coupe: 'Chasuble' },
        searchTerms: ['emerald green velvet pinafore dress product photo', 'green velvet dress white background fashion'],
      },
      {
        name: 'Pardessus en alpaga gris perle',
        description: 'Pardessus long en alpaga gris perle, simple boutonnage, col tailleur, poches à soufflet, doublure en soie grise. Scènes hivernales.',
        status: 'owned', market_value: 680, attributes: { Matière: 'Alpaga', Taille: 'L', Couleur: 'Gris perle', Saison: 'Hiver' },
        searchTerms: ['grey alpaca overcoat product photo neutral background', 'pearl grey wool coat fashion editorial'],
      },
      {
        name: 'Chemise western en daim frangée',
        description: 'Chemise western en daim naturel frangée aux manches et à la poitrine, broderies turquoise et corail, boutons nacre. Style années 70.',
        status: 'owned', market_value: 310, attributes: { Matière: 'Daim', Taille: 'M', Couleur: 'Camel', Style: 'Western 70s' },
        searchTerms: ['suede fringe western shirt product photo white background', 'boho fringed shirt fashion editorial'],
      },
      {
        name: 'Short en soie imprimé léopard',
        description: 'Short taille haute en soie imprimé léopard, empiècements satinés, fermeture latérale invisible. Personnage glamour, scènes de plage.',
        status: 'owned', market_value: 175, attributes: { Matière: 'Soie', Taille: 'S', Couleur: 'Léopard', Style: 'Glamour' },
        searchTerms: ['leopard print silk shorts product photo white background', 'animal print fashion shorts neutral background'],
      },
      {
        name: 'Manteau de fourrure synthétique ivoire',
        description: 'Long manteau en fausse fourrure ivoire à poils longs, col large, fermeture à crochets, doublure satin noir. Scène finale.',
        status: 'owned', market_value: 520, attributes: { Matière: 'Fourrure synthétique', Taille: 'M', Couleur: 'Ivoire', Usage: 'Scène finale' },
        searchTerms: ['ivory faux fur coat product photo white background', 'long white fur coat fashion editorial'],
      },
      {
        name: 'Veste universitaire letterman rouge et blanc',
        description: 'Blouson universitaire en laine rouge, manches en cuir blanc, écusson "Black Bears" brodé, fermeture éclair dorée. Personnage lycéen.',
        status: 'owned', market_value: 265, attributes: { Matière: 'Laine et cuir', Taille: 'L', Couleur: 'Rouge/Blanc', Style: 'Varsity américain' },
        searchTerms: ['letterman varsity jacket red white product photo', 'college jacket fashion editorial neutral background'],
      },
    ],
  },

}

// ─── Unsplash helpers ─────────────────────────────────────────────────────────

async function fetchUnsplashUrl(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) return null
  return new Promise(resolve => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish&content_filter=high`
    https.get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }, res => {
      let raw = ''
      res.on('data', (c: Buffer) => raw += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          // Prend une photo aléatoire parmi les 3 premiers résultats pour varier
          const results = json.results ?? []
          if (results.length === 0) { resolve(null); return }
          const pick = results[Math.floor(Math.random() * results.length)]
          resolve(pick?.urls?.regular ?? null)
        } catch { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
}

async function findBestPhoto(obj: SeedObject): Promise<string | null> {
  // Termes à essayer dans l'ordre
  const terms = [
    ...(obj.searchTerms ?? []),
    obj.name,
  ]

  for (const term of terms) {
    const url = await fetchUnsplashUrl(term)
    if (url) return url
  }
  return null
}

async function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

// ─── Replicate / Flux helpers ─────────────────────────────────────────────────

function buildFluxPrompt(obj: SeedObject): string {
  // Cherche les searchTerms qui semblent être des prompts photo (contiennent "product photo" etc.)
  const terms = obj.searchTerms ?? []
  const base = terms.find(t => t.includes('product photo') || t.includes('editorial')) ?? obj.name
  return `${base}, isolated on pure white background, professional studio lighting, high resolution product photography, sharp focus, fashion editorial quality`
}

async function replicateFlux(prompt: string): Promise<string | null> {
  if (!REPLICATE_API_TOKEN) return null

  // 1. Créer la prédiction
  const body = JSON.stringify({
    input: { prompt, aspect_ratio: '1:1', output_format: 'jpg', output_quality: 90 },
  })

  const predictionId = await new Promise<string | null>((resolve) => {
    const req = https.request(
      {
        hostname: 'api.replicate.com',
        path: '/v1/models/black-forest-labs/flux-schnell/predictions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let raw = ''
        res.on('data', (c: Buffer) => raw += c)
        res.on('end', () => {
          try { resolve(JSON.parse(raw).id ?? null) } catch { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })

  if (!predictionId) return null

  // 2. Polling jusqu'à succeeded (max 60s)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const result = await new Promise<any>((resolve) => {
      https.get(
        {
          hostname: 'api.replicate.com',
          path: `/v1/predictions/${predictionId}`,
          headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
        },
        res => {
          let raw = ''
          res.on('data', (c: Buffer) => raw += c)
          res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(null) } })
        }
      ).on('error', () => resolve(null))
    })

    if (!result) break
    if (result.status === 'succeeded') {
      const output = result.output
      return Array.isArray(output) ? output[0] : (output ?? null)
    }
    if (result.status === 'failed' || result.status === 'canceled') break
  }

  return null
}

async function findBestImage(obj: SeedObject): Promise<{ url: string; source: 'replicate' | 'unsplash' } | null> {
  // Priorité 1 : Replicate/Flux (images générées IA)
  if (REPLICATE_API_TOKEN) {
    const url = await replicateFlux(buildFluxPrompt(obj))
    if (url) return { url, source: 'replicate' }
  }

  // Priorité 2 : Unsplash (photos libres de droit)
  if (UNSPLASH_ACCESS_KEY) {
    const terms = [...(obj.searchTerms ?? []), obj.name]
    for (const term of terms) {
      const url = await fetchUnsplashUrl(term)
      if (url) return { url, source: 'unsplash' }
    }
  }

  return null
}

async function uploadImage(
  supabase: any,
  objectId: string,
  userId: string,
  imageUrl: string
): Promise<void> {
  const buffer = await downloadBuffer(imageUrl)
  const storagePath = `${userId}/${objectId}/unsplash-0.jpg`

  const { error: upErr } = await supabase.storage
    .from('object-images')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

  if (upErr) { console.error(`    ⚠ Upload image échoué: ${upErr.message}`); return }

  const { error: dbErr } = await (supabase.from('object_images') as any).insert({
    object_id: objectId,
    user_id: userId,
    storage_path: storagePath,
    mime_type: 'image/jpeg',
    size_bytes: buffer.length,
    position: 0,
    is_cover: true,
  })

  if (dbErr) console.error(`    ⚠ Enregistrement image échoué: ${dbErr.message}`)
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(flag: string) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

if (args.includes('--list')) {
  console.log('\nThèmes disponibles :')
  for (const [key, theme] of Object.entries(THEMES)) {
    console.log(`  --theme ${key.padEnd(15)} ${theme.label} (${theme.objects.length} objets)`)
  }
  console.log()
  process.exit(0)
}

const themeName = getArg('--theme')
const email     = getArg('--email')
const password  = getArg('--password')

if (!themeName) {
  console.error('Usage: npx ts-node scripts/seed-objects.ts --theme <nom> --email <email> --password <mdp>')
  console.error('       npx ts-node scripts/seed-objects.ts --list')
  process.exit(1)
}

const theme = THEMES[themeName]
if (!theme) {
  console.error(`Thème "${themeName}" inconnu. Lancez --list pour voir les thèmes disponibles.`)
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { transport: ws },
  })

  // Auth
  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { console.error('Auth error:', error.message); process.exit(1) }
    console.log(`✓ Connecté en tant que ${email}`)
  } else {
    // Vérifier la session existante
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('Aucune session active. Passez --email et --password.')
      process.exit(1)
    }
    console.log(`✓ Session existante pour ${session.user.email}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.error('User introuvable'); process.exit(1) }

  // Récupérer un drawer existant (requis NOT NULL sur collections)
  const { data: drawer } = await supabase.from('drawers').select('id').eq('user_id', user.id).limit(1).single()
  if (!drawer) { console.error('Aucun drawer trouvé pour cet utilisateur.'); process.exit(1) }
  const drawerId = drawer.id

  // Créer ou récupérer la collection
  let collectionId: string | null = null
  const { data: existingCol } = await supabase
    .from('collections')
    .select('id')
    .eq('name', theme.collectionName)
    .eq('user_id', user.id)
    .single()

  if (existingCol) {
    collectionId = existingCol.id
    console.log(`✓ Collection existante : "${theme.collectionName}"`)
  } else {
    const { data: newCol, error: colErr } = await supabase
      .from('collections')
      .insert({ name: theme.collectionName, user_id: user.id, drawer_id: drawerId, emoji: theme.collectionEmoji, icon_color: theme.collectionColor })
      .select('id').single()
    if (colErr || !newCol) { console.error('Erreur création collection:', colErr?.message); process.exit(1) }
    collectionId = newCol.id
    console.log(`✓ Collection créée : "${theme.collectionName}"`)
  }

  // Insérer les objets
  console.log(`\nInsertion de ${theme.objects.length} objets...`)
  let success = 0

  for (const obj of theme.objects) {
    const { data: inserted, error } = await supabase.from('objects').insert({
      title: obj.name,
      description: obj.description,
      status: obj.status,
      market_value: obj.market_value ?? null,
      attributes: obj.attributes ?? {},
      collection_id: collectionId,
      user_id: user.id,
    }).select('id').single()
    const insertedId: string | null = inserted?.id ?? null

    if (error) {
      console.error(`  ✗ "${obj.name}": ${error.message}`)
    } else {
      success++
      const objectId = insertedId
      let photoStatus = ''
      if ((REPLICATE_API_TOKEN || UNSPLASH_ACCESS_KEY) && objectId) {
        const result = await findBestImage(obj)
        if (result) {
          await uploadImage(supabase, objectId, user.id, result.url)
          photoStatus = result.source === 'replicate' ? ' 🎨' : ' 📸'
        } else {
          photoStatus = ' (pas de photo)'
        }
      }
      process.stdout.write(`  ✓ (${success}/${theme.objects.length}) ${obj.name}${photoStatus}\n`)
    }
  }

  console.log(`\n✅ ${success}/${theme.objects.length} objets créés dans "${theme.collectionName}"`)
}

main().catch(err => { console.error(err); process.exit(1) })
