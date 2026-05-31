const https = require('https');
const fs = require('fs');

const POKEMON_API_URL = 'https://pokeapi.co/api/v2/pokemon?limit=1200'; // Fetch all pokemon
const OUTPUT_PATH = 'public/pokemon_data.json';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function generatePokemonData() {
    console.log('Starting Pokémon data generation... This will take several minutes.');
    try {
        const pokemonList = await fetchJson(POKEMON_API_URL);
        const pokemonData = [];
        let processedCount = 0;

        // Using a for...of loop to process sequentially with a delay to avoid rate limiting.
        for (const pokemon of pokemonList.results) {
            try {
                const details = await fetchJson(pokemon.url);
                pokemonData.push({
                    id: details.id,
                    name: details.name,
                    sprite: details.sprites.front_default,
                    types: details.types.map(t => t.type.name),
                });
                processedCount++;
                // Log progress every 50 pokemon
                if (processedCount % 50 === 0) {
                    console.log(`Processed ${processedCount} of ${pokemonList.results.length} Pokémon...`);
                }
                // Small delay to be nice to the API
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.warn(`Could not fetch details for ${pokemon.name}. Skipping. Error: ${error.message}`);
            }
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pokemonData, null, 2));
        console.log(`\nSuccessfully created ${OUTPUT_PATH} with ${pokemonData.length} Pokémon.`);

    } catch (error) {
        console.error('Failed to generate pokemon_data.json:', error);
    }
}

generatePokemonData();
