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
      { name: 'Table de chevet Art déco en palissandre', description: 'Petite table de nuit en palissandre avec un tiroir et une tablette basse, pieds fuselés, tiroir avec poignée en bakélite noire.', status: 'owned', market_value: 190, purchase_price: 60, purchase_year: 2022, attributes: { Matière: 'Palissandre', Époque: 'Art déco (1925-1940)', Dimensions: '45 × 38 × 65 cm' } },
      { name: 'Lampe de bureau articulée Jielde', description: 'Lampe industrielle Jielde 2 bras en acier laqué gris anthracite, joints parfaitement huilés, câble refait à neuf, douille E27. Made in France.', status: 'owned', market_value: 320, purchase_price: 95, purchase_year: 2023, attributes: { Marque: 'Jielde', Couleur: 'Gris anthracite', État: 'Restaurée', Origine: 'France' } },
      { name: 'Buffet bas Henri II en chêne', description: 'Buffet deux corps en chêne sculpté avec motifs Renaissance, deux portes avec panneaux sculptés de feuilles d\'acanthe, serrures d\'origine avec clés.', status: 'owned', market_value: 950, purchase_price: 280, purchase_year: 2020, attributes: { Matière: 'Chêne massif', Style: 'Henri II', Dimensions: '160 × 55 × 85 cm', Époque: '1880-1900' } },
      { name: 'Pendule de cheminée en marbre noir', description: 'Pendule de cheminée Empire en marbre noir belge, mouvement à sonnerie 8 jours révisé, colonnes en bronze doré, cadran en émail blanc.', status: 'owned', market_value: 480, purchase_price: 150, purchase_year: 2021, attributes: { Style: 'Empire', Matière: 'Marbre noir et bronze', Mouvement: '8 jours, sonnerie', Dimensions: '38 × 15 × 36 cm' } },
      { name: 'Fauteuil crapaud en velours bleu paon', description: 'Fauteuil crapaud entièrement retapissé en velours côtelé bleu paon, bois laqué noir, ressorts refaits, très confortable.', status: 'owned', market_value: 420, purchase_price: 140, purchase_year: 2022, attributes: { Tissu: 'Velours bleu paon', Époque: 'Napoléon III', État: 'Restauré', Dimensions: '75 × 70 × 85 cm' } },
      { name: 'Carafe en cristal de Baccarat', description: 'Carafe à vin en cristal taillé, panse à panneaux taillés en biseau, col torsadé, bouchon d\'origine. Marque Baccarat gravée sous la base.', status: 'owned', market_value: 240, purchase_price: 45, purchase_year: 2023, attributes: { Marque: 'Baccarat', Matière: 'Cristal', Contenance: '1L', État: 'Parfait' } },
      { name: 'Bureau cylindre en acajou', description: 'Bureau à cylindre en acajou avec 6 tiroirs latéraux et compartiments intérieurs, cylindre en lattes d\'acajou, tablette coulissante en cuir vert.', status: 'owned', market_value: 1400, purchase_price: 450, purchase_year: 2019, attributes: { Matière: 'Acajou massif', Époque: '1880-1900', Dimensions: '140 × 80 × 120 cm', Garnissage: 'Cuir vert' } },
      { name: 'Vase soliflore en opaline rose', description: 'Vase soliflore en opaline rose soufflée bouche, col effilé, base évasée. Opaline de Bohème, milieu XIXe siècle.', status: 'owned', market_value: 95, purchase_price: 18, purchase_year: 2023, attributes: { Matière: 'Opaline soufflée', Couleur: 'Rose', Époque: '1850-1870', Hauteur: '22 cm' } },
      { name: 'Étagère à corniche style Empire', description: 'Petite étagère murale Empire en acajou avec colonnettes et corniche à frise de perles, 3 tablettes, patine chaleureuse.', status: 'owned', market_value: 280, purchase_price: 75, purchase_year: 2022, attributes: { Style: 'Empire', Matière: 'Acajou', Dimensions: '80 × 20 × 90 cm' } },
      { name: 'Pot à tabac en grès de Beauvaisis', description: 'Pot à tabac couvert en grès salé bleu-gris, décor incisé de feuilles de vigne, bouchon en bois tourné d\'origine.', status: 'owned', market_value: 65, purchase_price: 12, purchase_year: 2023, attributes: { Matière: 'Grès salé', Époque: 'XIXe siècle', Origine: 'Beauvais', Hauteur: '14 cm' } },
      { name: 'Sellette en acajou style Napoléon III', description: 'Sellette à colonne torsadée en acajou, plateau carré avec galerie en bronze, base tripode à roulettes de cuivre.', status: 'owned', market_value: 320, purchase_price: 90, purchase_year: 2021, attributes: { Style: 'Napoléon III', Matière: 'Acajou et bronze', Dimensions: '35 × 35 × 110 cm' } },
      { name: 'Machine à écrire Hermès 3000', description: 'Machine à écrire portable Hermès 3000 en aluminium brossé, ruban neuf, tous les mécanismes fonctionnels, coffret d\'origine.', status: 'owned', market_value: 280, purchase_price: 55, purchase_year: 2022, attributes: { Marque: 'Hermès', Modèle: '3000', Année: '1965', État: 'Fonctionnelle' } },
      { name: 'Candélabre en bronze doré à 5 lumières', description: 'Paire de candélabres en bronze doré au feu, 5 bobèches par bras, fûts en colonne à chapiteaux corinthiens, époque Restauration.', status: 'owned', market_value: 680, purchase_price: 200, purchase_year: 2020, attributes: { Matière: 'Bronze doré', Époque: 'Restauration (1815-1830)', Hauteur: '65 cm', Luminosité: '5 bras' } },
      { name: 'Chaise longue Récamier en acajou', description: 'Chaise longue Récamier Empire en acajou, rembourrage retapissé en soie ivoire, pieds en sabre, têtière réglable.', status: 'owned', market_value: 1100, purchase_price: 380, purchase_year: 2019, attributes: { Style: 'Empire', Matière: 'Acajou et soie', Dimensions: '185 × 65 cm', État: 'Restaurée' } },
      { name: 'Bouillotte en étain avec robinet', description: 'Bouillotte chauffante en étain poli avec robinet en laiton, anse articulée, fond bombé, poinçon de maître sur le couvercle.', status: 'owned', market_value: 120, purchase_price: 25, purchase_year: 2023, attributes: { Matière: 'Étain', Époque: 'XIXe siècle', Capacité: '3L', État: 'Très bon' } },
      { name: 'Secrétaire à abattant en loupe de frêne', description: 'Secrétaire à abattant en loupe de frêne avec intérieur en acajou, 8 petits tiroirs et 3 compartiments, filets d\'ébène en marqueterie.', status: 'owned', market_value: 880, purchase_price: 260, purchase_year: 2021, attributes: { Matière: 'Loupe de frêne et acajou', Époque: '1800-1830', Dimensions: '90 × 45 × 145 cm' } },
      { name: 'Statuette en biscuit de Sèvres', description: 'Statuette représentant une bergère en biscuit de porcelaine non émaillé, base ovale, très légères éclats sous la base non visibles.', status: 'owned', market_value: 340, purchase_price: 80, purchase_year: 2022, attributes: { Manufacture: 'Sèvres', Matière: 'Biscuit de porcelaine', Époque: '1780-1820', Hauteur: '28 cm' } },
      { name: 'Table gigogne laquée noire (set de 3)', description: 'Set de 3 tables gigognes en laque noire, plateau avec motif floral peint à la main, pieds cambrés, style Chinoiserie.', status: 'owned', market_value: 260, purchase_price: 70, purchase_year: 2022, attributes: { Style: 'Chinoiserie', Matière: 'Laque noire', Époque: '1920-1940', Nombre: '3 tables' } },
      { name: 'Baromètre amiral en acajou', description: 'Baromètre de marine en acajou avec tube de Torricelli d\'origine, échelle en laiton gravée, cuvette en corne.', status: 'owned', market_value: 480, purchase_price: 120, purchase_year: 2020, attributes: { Type: 'Baromètre amiral', Matière: 'Acajou et laiton', Époque: '1870-1900', Fonctionnement: 'Oui' } },
      { name: 'Tabouret de piano réglable en velours vert', description: 'Tabouret de piano réglable à vis en bois laqué noir, assise ronde retapissée en velours vert empire, croisillon en laiton.', status: 'owned', market_value: 180, purchase_price: 45, purchase_year: 2023, attributes: { Matière: 'Bois laqué et velours', Couleur: 'Vert empire', Réglage: 'À vis', Époque: '1900-1920' } },
      { name: 'Assiette en faïence de Quimper (lot de 6)', description: 'Lot de 6 assiettes plates en faïence de Quimper, décor folklorique breton peint à la main, dos avec marque Henriot Quimper.', status: 'owned', market_value: 210, purchase_price: 48, purchase_year: 2022, attributes: { Manufacture: 'Henriot Quimper', Matière: 'Faïence', Décor: 'Breton', Nombre: '6 assiettes' } },
      { name: 'Cadre baguette en bois doré (75 × 60 cm)', description: 'Grand cadre vide en bois doré à la feuille, baguette à double rang de perles, coins à rosaces, dorure à 80% d\'origine.', status: 'owned', market_value: 220, purchase_price: 55, purchase_year: 2021, attributes: { Matière: 'Bois doré à la feuille', Dimensions: '75 × 60 cm (extérieur)', Style: 'Louis XVI', Époque: '1880-1920' } },
      { name: 'Écritoire de voyage en maroquin rouge', description: 'Écritoire de voyage en maroquin rouge estampé, intérieur en soie ivoire avec compartiments, porte-plume et encrier en verre inclus.', status: 'owned', market_value: 320, purchase_price: 85, purchase_year: 2022, attributes: { Matière: 'Maroquin et soie', Couleur: 'Rouge', Époque: '1880-1910', État: 'Très bon' } },
      { name: 'Semainier en ébène de Macassar', description: 'Semainier Art déco à 7 tiroirs en ébène de Macassar, poignées en chrome, structure en chêne plaqué, pieds droits gainés de cuivre.', status: 'owned', market_value: 1250, purchase_price: 400, purchase_year: 2020, attributes: { Matière: 'Ébène de Macassar', Style: 'Art déco', Dimensions: '55 × 40 × 120 cm', Époque: '1925-1935' } },
      { name: 'Théière en argent massif poinçonné', description: 'Théière en argent massif, panse piriforme, bec verseur en col de cygne, manche en ébène, poinçons Minerve et maître-orfèvre.', status: 'owned', market_value: 680, purchase_price: 200, purchase_year: 2021, attributes: { Matière: 'Argent massif 950', Poinçon: 'Minerve', Capacité: '1,2 L', Époque: '1890-1910' } },
      { name: 'Penderie de voyage en cuir fauve', description: 'Ancienne penderie de voyage en cuir fauve, ferrures en laiton, barre de suspension chromée, étiquettes de Grand Hôtel à l\'intérieur.', status: 'owned', market_value: 380, purchase_price: 95, purchase_year: 2022, attributes: { Matière: 'Cuir fauve et laiton', Époque: '1920-1940', Dimensions: '50 × 30 × 90 cm', Provenance: 'Grand Hôtel' } },
      { name: 'Applique murale en bronze Art Nouveau', description: 'Paire d\'appliques murales en bronze patiné, pétales de lys stylisés formant le diffuseur, câble refait, ampoule E14.', status: 'owned', market_value: 480, purchase_price: 130, purchase_year: 2021, attributes: { Style: 'Art Nouveau', Matière: 'Bronze patiné', Époque: '1900-1920', État: 'Restaurée' } },
      { name: 'Coffret à bijoux en marqueterie de paille', description: 'Coffret à bijoux rectangulaire en marqueterie de paille dorée et naturelle, intérieur en satin ivoire, miroir au couvercle, serrure dorée.', status: 'owned', market_value: 180, purchase_price: 40, purchase_year: 2023, attributes: { Matière: 'Marqueterie de paille', Époque: '1940-1950', Dimensions: '25 × 18 × 12 cm', Intérieur: 'Satin ivoire' } },
      { name: 'Chaise longue de jardin en teck', description: 'Chaise longue de jardin coloniale en teck massif, lattes larges, dossier ajustable à 5 positions, accoudoirs plats.', status: 'owned', market_value: 420, purchase_price: 110, purchase_year: 2022, attributes: { Matière: 'Teck massif', Style: 'Colonial', Époque: '1920-1940', État: 'Très bon' } },
      { name: 'Télescope de marine en laiton', description: 'Longue-vue de marine à 3 tirants en laiton poli et cuir brun, optique parfaitement claire, grossissement 30x, longueur déployée 90 cm.', status: 'owned', market_value: 280, purchase_price: 65, purchase_year: 2021, attributes: { Matière: 'Laiton et cuir', Grossissement: '30x', Longueur: '90 cm déployé', Époque: '1900-1930' } },
      { name: 'Coiffeuse triptyque en bois de rose', description: 'Coiffeuse à 3 miroirs en bois de rose, plateau en marbre rose, 2 petits tiroirs latéraux, pieds cambrés, quincaillerie en bronze.', status: 'owned', market_value: 760, purchase_price: 220, purchase_year: 2020, attributes: { Matière: 'Bois de rose et marbre', Époque: 'Napoléon III', Dimensions: '120 × 55 × 155 cm' } },
      { name: 'Paire de chenets en fonte de Tubalcain', description: 'Paire de chenets en fonte à décor de lions héraldiques, crémaillère en fer forgé incluse, belle patine noire d\'origine.', status: 'owned', market_value: 240, purchase_price: 60, purchase_year: 2022, attributes: { Matière: 'Fonte et fer', Décor: 'Lions héraldiques', Époque: 'XIXe siècle', Hauteur: '30 cm' } },
      { name: 'Porte-manteau en bambou tourné', description: 'Porte-manteau sur pied en bambou naturel tourné, 8 crochets en laiton, base à 4 pieds en croix, style exotique colonial.', status: 'owned', market_value: 210, purchase_price: 50, purchase_year: 2023, attributes: { Matière: 'Bambou et laiton', Style: 'Colonial', Hauteur: '185 cm', Crochets: '8' } },
      { name: 'Plateau de service en argent plaqué Sheffield', description: 'Grand plateau ovale en argent plaqué Sheffield avec bords godronés et poignées ajourées, gravure centrale d\'armoiries.', status: 'owned', market_value: 160, purchase_price: 35, purchase_year: 2023, attributes: { Matière: 'Argent plaqué Sheffield', Dimensions: '55 × 38 cm', Époque: '1880-1910', Décor: 'Armoiries gravées' } },
      { name: 'Carnet de cuir de Harry Mintz Paris', description: 'Carnet de notes en cuir brun grainé, reliure cousue à la main, pages vergé ivoire, fermoir en laiton, signet en soie rouge.', status: 'owned', market_value: 85, purchase_price: 20, purchase_year: 2022, attributes: { Fabricant: 'Harry Mintz Paris', Matière: 'Cuir grainé', Époque: '1950-1970', Dimensions: '15 × 10 cm' } },
      { name: 'Bahut renaissance en chêne sculpté', description: 'Bahut 2 portes en chêne sculpté à panneaux de médaillons Renaissance, galerie ajourée en crête, pieds carrés en gaine.', status: 'owned', market_value: 1800, purchase_price: 580, purchase_year: 2018, attributes: { Style: 'Renaissance', Matière: 'Chêne massif', Dimensions: '160 × 58 × 90 cm', Époque: '1860-1900' } },
      { name: 'Mannequin de couturière en toile de lin', description: 'Mannequin de couturière réglable en taille avec buste en toile de lin naturel, support en métal laqué noir, pied tripode en bois.', status: 'owned', market_value: 180, purchase_price: 45, purchase_year: 2023, attributes: { Type: 'Mannequin couturière', Matière: 'Toile de lin', Réglable: 'Oui (38-46)', Époque: '1940-1960' } },
      { name: 'Globe terrestre sur pied acajou', description: 'Globe terrestre géographique sur méridien en laiton et pied en acajou tourné, cartographie française datée de 1935, diamètre 32 cm.', status: 'owned', market_value: 520, purchase_price: 140, purchase_year: 2021, attributes: { Fabricant: 'Taride Paris', Diamètre: '32 cm', Année: '1935', Matière: 'Papier maché et acajou' } },
      { name: 'Fauteuil voltaire en tissu houndstooth', description: 'Fauteuil Voltaire en hêtre, retapissé en tissu pied-de-poule noir et blanc, rembourrage à ressorts ressauts, pieds tournés.', status: 'owned', market_value: 380, purchase_price: 100, purchase_year: 2022, attributes: { Tissu: 'Pied-de-poule noir et blanc', Époque: 'Napoléon III', État: 'Restauré', Dimensions: '80 × 85 × 100 cm' } },
      { name: 'Paire de vases balustre en porcelaine de Chine', description: 'Paire de vases balustres en porcelaine de Chine à décor bleu et blanc de dragons, famille bleue de Kangxi, avec montures en bronze.', status: 'owned', market_value: 1600, purchase_price: 480, purchase_year: 2019, attributes: { Origine: 'Chine, période Kangxi', Décor: 'Bleu et blanc, dragons', Montures: 'Bronze doré', Hauteur: '55 cm' } },
      { name: 'Armoire bretonne en chêne polychrome', description: 'Armoire paysanne bretonne à deux portes en chêne, panneaux sculptés de motifs floraux peints en bleu et rouge, intérieur avec 2 étagères.', status: 'owned', market_value: 1100, purchase_price: 320, purchase_year: 2020, attributes: { Origine: 'Bretagne', Matière: 'Chêne polychrome', Époque: '1780-1830', Dimensions: '140 × 55 × 195 cm' } },
      { name: 'Montre de gousset Longines or 18K', description: 'Montre de gousset Longines en boîtier or 18 carats, cadran émail blanc index romains, mouvement 17 rubis, chaîne en or jaune.', status: 'owned', market_value: 1400, purchase_price: 420, purchase_year: 2021, attributes: { Marque: 'Longines', Boîtier: 'Or 18K', Mouvement: '17 rubis', Époque: '1900-1920' } },
      { name: 'Chevet japonisant en laque noire et or', description: 'Table de chevet en bois laqué noir à décors dorés de branches de cerisier, tiroir unique, pied en sabots.', status: 'owned', market_value: 280, purchase_price: 75, purchase_year: 2022, attributes: { Style: 'Japonisant', Matière: 'Laque noire et or', Époque: '1880-1910', Dimensions: '40 × 35 × 72 cm' } },
      { name: 'Gramophone à pavillon La Voix de son Maître', description: 'Gramophone à pavillon en tôle peinte noir et or, boîte en acajou, plateau en métal, fonctionne avec moteur à ressort. Pavillon d\'origine complet.', status: 'owned', market_value: 850, purchase_price: 250, purchase_year: 2019, attributes: { Marque: 'La Voix de son Maître', Époque: '1910-1920', État: 'Fonctionnel', Pavillon: 'Original' } },
      { name: 'Tabatière en écaille et or poinçonné', description: 'Tabatière rectangulaire en écaille blonde montée en or 18K poinçonné, intérieur doré, charnière à ressort, monogramme gravé.', status: 'owned', market_value: 680, purchase_price: 180, purchase_year: 2021, attributes: { Matière: 'Écaille et or 18K', Poinçon: 'Minerve', Dimensions: '8 × 5 cm', Époque: '1870-1900' } },
      { name: 'Bureau Mazarin en marqueterie Boulle', description: 'Petit bureau Mazarin à 8 tiroirs en ébène et marqueterie Boulle (écaille et laiton), galerie en bronze ciselé, style Louis XIV.', status: 'owned', market_value: 3200, purchase_price: 980, purchase_year: 2018, attributes: { Style: 'Louis XIV', Technique: 'Marqueterie Boulle', Dimensions: '120 × 65 × 80 cm', Époque: '1880-1900' } },
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

}

// ─── Unsplash helpers ─────────────────────────────────────────────────────────

async function fetchUnsplashUrl(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) return null
  return new Promise(resolve => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`
    https.get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }, res => {
      let raw = ''
      res.on('data', (c: Buffer) => raw += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          resolve(json.results?.[0]?.urls?.regular ?? null)
        } catch { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
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

  // Créer ou récupérer la collection
  let collectionId: string | null = null
  const { data: existingCol } = await supabase
    .from('collections')
    .select('id')
    .eq('name', theme.collectionName)
    .single()

  if (existingCol) {
    collectionId = existingCol.id
    console.log(`✓ Collection existante : "${theme.collectionName}"`)
  } else {
    const { data: newCol, error: colErr } = await supabase
      .from('collections')
      .insert({ name: theme.collectionName, user_id: user.id, emoji: theme.collectionEmoji, icon_color: theme.collectionColor })
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
      if (UNSPLASH_ACCESS_KEY && objectId) {
        const imgUrl = await fetchUnsplashUrl(obj.name)
        if (imgUrl) {
          await uploadImage(supabase, objectId, user.id, imgUrl)
          photoStatus = ' 📸'
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
