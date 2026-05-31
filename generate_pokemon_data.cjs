const https = require('https');
const fs = require('fs');

const POKEMON_API_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=1200';
const OUTPUT_PATH = 'public/pokemon_data.json';

const STARTER_NAMES = [
    'bulbasaur', 'charmander', 'squirtle',
    'chikorita', 'cyndaquil', 'totodile',
    'treecko', 'torchic', 'mudkip',
    'turtwig', 'chimchar', 'piplup',
    'snivy', 'tepig', 'oshawott',
    'chespin', 'fennekin', 'froakie',
    'rowlet', 'litten', 'popplio',
    'grookey', 'scorbunny', 'sobble',
    'sprigatito', 'fuecoco', 'quaxly'
];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function getSprite(s, variant) {
    const v = s[variant];
    if (v) return v;
    const oa = s.other?.['official-artwork']?.[variant];
    if (oa) return oa;
    const home = s.other?.home?.[variant];
    if (home) return home;
    return null;
}

async function generatePokemonData() {
    console.log('Starting Pokémon data generation... This will take several minutes.');
    try {
        const pokemonList = await fetchJson(POKEMON_API_URL);
        const pokemonData = [];
        let processedCount = 0;

        for (const species of pokemonList.results) {
            const speciesDetails = await fetchJson(species.url);
            const genNumber = speciesDetails.generation
                ? speciesDetails.generation.url.match(/\/generation\/(\d+)\//)?.[1]
                : null;
            const hasGenderDiff = speciesDetails.has_gender_differences;

            for (const variety of speciesDetails.varieties) {
                try {
                    const details = await fetchJson(variety.pokemon.url);
                    const name = details.name;
                    const baseSprite = getSprite(details.sprites, 'front_default');
                    const shinySprite = getSprite(details.sprites, 'front_shiny');

                    const entry = {
                        id: details.id,
                        name: name,
                        sprite: {
                            normal: baseSprite,
                            shiny: shinySprite
                        },
                        types: details.types.map(t => ({ slot: t.slot, name: t.type.name })),
                        generation: genNumber ? `generation-${genNumber}` : null,
                        is_legendary: speciesDetails.is_legendary,
                        is_mythical: speciesDetails.is_mythical,
                        is_starter: STARTER_NAMES.includes(speciesDetails.name),
                        is_mega: name.includes('-mega'),
                        is_gmax: name.endsWith('-gmax'),
                        is_female: false
                    };

                    if (baseSprite) {
                        pokemonData.push(entry);
                    } else {
                        console.warn(`Skipping ${name} (id ${details.id}) - no sprite available`);
                    }

                    // Add female variant if gender differences exist and female sprites exist
                    const femaleSprite = getSprite(details.sprites, 'front_female');
                    const shinyFemaleSprite = getSprite(details.sprites, 'front_shiny_female');
                    if (hasGenderDiff && femaleSprite) {
                        pokemonData.push({
                            id: details.id + 20000,
                            name: name + '-female',
                            sprite: {
                                normal: femaleSprite,
                                shiny: shinyFemaleSprite
                            },
                            types: details.types.map(t => ({ slot: t.slot, name: t.type.name })),
                            generation: genNumber ? `generation-${genNumber}` : null,
                            is_legendary: speciesDetails.is_legendary,
                            is_mythical: speciesDetails.is_mythical,
                            is_starter: false,
                            is_mega: false,
                            is_gmax: false,
                            is_female: true
                        });
                    }

                    processedCount++;
                    if (processedCount % 50 === 0) {
                        console.log(`Processed ${processedCount} Pokémon...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    console.warn(`Could not fetch details for ${variety.pokemon.name}. Skipping. Error: ${error.message}`);
                }
            }
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pokemonData, null, 2));
        console.log(`\nSuccessfully created ${OUTPUT_PATH} with ${pokemonData.length} Pokémon.`);

    } catch (error) {
        console.error('Failed to generate pokemon_data.json:', error);
    }
}

generatePokemonData();
