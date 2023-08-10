/*
 * Version 0.0.2
 *
 * Made By Kris Parsons
 * Discord: kris0918
 * Github: 
 * Paypal.me: https://www.paypal.me/kristianparsons
 *
 */

(function() {
    const _ABILITIES = {1:'MIGHT',2:'DEFT',3:'SMART'};
    const _ABILITY = {'MIGHT': 'might', 'DEFT': 'deft', 'SMART': 'smart'};
    //const abilities = ['MIGHT','DEFT','SMART'];
    //const ethos = ['','Arbitrator', 'Benefactor', 'Champion','Esurient','Guardian','Judicator','Mastermind','Megalomaniac','Radical'];
    const might_skills = ['athletics','influence','psionics'];
    const deft_skills = ['crafting','culture','lore','perception','performance','reflexes','thaumaturgy'];
    const smart_skills = ['domain_knowledge','nature','sorcery','trade'];
    const all_skills = might_skills.concat(deft_skills, smart_skills);

 
      // TODO: Get OSR+ list, determine if we need to categorize into type
      const weapons = ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light Hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear', 'Crossbow, Light', 'Dart', 'Shortbow', 'Sling', 'Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War Pick', 'Warhammer', 'Whip', 'Blowgun', 'Crossbow, Hand', 'Crossbow, Heavy', 'Longbow', 'Net'];

    //let class_spells = [];
    //let spellAttacks = [];
    let osrp_caller = {};
    let object;

      // Styling for the chat responses.
    const style = "margin-left: 0px; overflow: hidden; background-color: #fff; border: 1px solid #000; padding: 5px; border-radius: 5px;";
    const buttonStyle = "background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; float: right;"
    
    const script_name = 'OSRPlusImporter';
    const state_name = 'OSRPLUSIMPORTER';
    const debug = true;
    var spellTargetInAttacks = true;
  
    // Roll 20 specific actions - chat functions
    on('ready', function() {
        checkInstall();
        log(script_name + ' Ready! Command: !osrplus');
        if(debug) { sendChat(script_name, script_name + ' Ready!', null, {noarchive:true}); }
    });

    on('chat:message', (msg) => {
        if (msg.type != 'api') return;

        // Split the message into command and argument(s)
        let args = msg.content.split(/ --(help|reset|config|imports|import) ?/g);
        let command = args.shift().substring(1).trim();

        osrp_caller = getObj('player', msg.playerid);

        if (command !== 'osrplus') {
            return;
        }
        let importData = '';
        if(args.length < 1) { sendHelpMenu(osrp_caller); return; }

        let config = state[state_name][osrp_caller.id].config;
        let initTiebreaker = config.initTieBreaker;
        let languageGrouping = config.languageGrouping;
        
        // if not set, we default to true even without a config reset
        if (config.hasOwnProperty('spellTargetInAttacks')) {
            spellTargetInAttacks = config.spellTargetInAttacks;
        }

        for(let i = 0; i < args.length; i+=2) {
            let k = args[i].trim();
            let v = args[i+1] != null ? args[i+1].trim() : null;

            switch(k) {
                case 'help':
                    sendHelpMenu(osrp_caller);
                    return;

                case 'reset':
                    state[state_name][osrp_caller] = {};
                    setDefaults(true);
                    sendConfigMenu(osrp_caller);
                    return;

                case 'config':
                    if(args.length > 0){
                        let setting = v.split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : (setting[0] === '[NONE]') ? '' : setting[0];

                        if(key === 'prefix' && value.charAt(0) !== '_' && value.length > 0) { value = value + ' ';}
                        if(key === 'suffix' && value.charAt(0) !== '_' && value.length > 0) { value = ' ' + value}

                        state[state_name][osrp_caller.id].config[key] = value;
                    }

                    sendConfigMenu(osrp_caller);
                    return;

                case 'imports':
                    if(args.length > 0){
                        let setting = v.split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : (setting[0] === '[NONE]') ? '' : setting[0];

                        state[state_name][osrp_caller.id].config.imports[key] = value;
                    }

                    sendConfigMenu(osrp_caller);
                    return;

                case 'import':
                    importData = v;
                    break;

                default:
                    sendHelpMenu(osrp_caller);
                    return;
            }
        }
     
  
        if(importData === '') {
            return;
        }
  
        let json = importData;
        let character = JSON.parse(json).data;
        if(debug) { sendChat(script_name, script_name + ' Past JSON import!', null, {noarchive:true}); }
        //Roll20 specific function - report to chat
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is starting.</div>', null, {noarchive:true});

        class_spells = [];

        // these are automatically sorted into attributes that are written individually, in alphabetical order
        // and other attributes that are then written as a bulk write, but all are written before repeating_attributes
        let single_attributes = {};

        // these are written in one large write once everything else is written
        // NOTE: changing any stats after all these are imported would create a lot of updates, so it is
        // good that we write these when all the stats are done
        let repeating_attributes = {};

        object = null;
  
        // Remove characters with the same name if overwrite is enabled.
        if(state[state_name][osrp_caller.id].config.overwrite) {
            let objects = findObjs({
                _type: "character",
                name: state[state_name][osrp_caller.id].config.prefix + character.name + state[state_name][osrp_caller.id].config.suffix
            }, {caseInsensitive: true});

            if(objects.length > 0) {
                object = objects[0];
                for(let i = 1; i < objects.length; i++){
                    objects[i].remove();
                }
            }
        }
  
        if(!object) {
            // Create character object
            object = createObj("character", {
                name: state[state_name][osrp_caller.id].config.prefix + character.name + state[state_name][osrp_caller.id].config.suffix,
                inplayerjournals: playerIsGM(msg.playerid) ? state[state_name][osrp_caller.id].config.inplayerjournals : msg.playerid,
                controlledby: playerIsGM(msg.playerid) ? state[state_name][osrp_caller.id].config.controlledby : msg.playerid
            });
        }

        // base class, if set
        if (character.object_class && (character.object_class.length > 0)) {
            Object.assign(single_attributes, {
                'class': character.object_class.post_title
            });
        }
  
        let total_level = character.level;
      
        //TODO: Need to validate this against OSR+ exploding dice rules
        //let weapon_critical_range = 20;
        //let critical_range = 20;

/*
 * MISSING/INSERT HERE
 *
 * Add Remaining OSR+ items 
 *
 */

          let other_attributes = {
            // Base Info
            'character_quote':character.catchphrase,
            'origin':character.object_origin.post_title,
            'class':character.object_class.post_title,
            'kit':character.object_kit.post_title,
            'ethos': character.object_ethos.post_title,
            'culture':character.object_culture.post_title,
            'faction':character.object_faction.post_title,
            'archetype':character.object_archetype.post_title
            /*
            // Bio Info
            'age': (character.age || ''),
            'size': (character.size || ''),
            'height': (character.height || ''),
            'weight': (character.weight || ''),
            'eyes': (character.eyes || ''),
            'hair': (character.hair || ''),
            'skin': (character.skin || ''),
            'character_appearance': (character.traits.appearance || ''),
            */
            
            // Ability Scores
            //'might_base': getTotalAbilityScore(character, 1),
            //'deft_base': getTotalAbilityScore(character, 2),
            //'smart_base': getTotalAbilityScore(character, 3)
            
            /*
            // Traits
            'personality_traits': character.traits.personalityTraits,
            'options-flag-personality': '0',
            'ideals': character.traits.ideals,
            'options-flag-ideals': '0',
            'bonds': character.traits.bonds,
            'options-flag-bonds': '0',
            'flaws': character.traits.flaws,
            'options-flag-flaws': '0',

            // currencies
            'cp': character.currencies.cp,
            'sp': character.currencies.sp,
            'gp': character.currencies.gp,
            'ep': character.currencies.ep,
            'pp': character.currencies.pp,

            // Notes/Bio
            'character_backstory': character.notes.backstory,
            'allies_and_organizations': contacts,
            'additional_feature_and_traits': otherNotes,
            'treasure': treasure,

            'global_save_mod_flag': 1,
            'global_skill_mod_flag': 1,
            'global_attack_mod_flag': 1,
            'global_damage_mod_flag': 1, 
            'dtype': 'full',
            'init_tiebreaker': initTiebreaker ? '@{dexterity}/100' : '',
            'initiative_style': calculateInitiativeStyle(character),
            'initmod': ('initiative' in modifiers)?modifiers.initiative.bonus:0,
            'jack_of_all_trades': (jack_feature !== undefined)?'@{jack}':'0'
        */
        };

        Object.assign(single_attributes, other_attributes);

        // these do not need to be written carefully, because they aren't looked at until the sheet is opened
        Object.assign(single_attributes, {
            // prevent upgrades, because they recalculate the class (saves etc.)
            'version': '2.5',

            // prevent character mancer from doing anything
            'l1mancer_status': 'complete',
            'mancer_cancel': 'on'
        });

        // check for bad attribute values and change them to empty strings, because these will cause a crash otherwise
        // ('Error: Firebase.update failed: First argument contains undefined in property 'current'')
        let illegal = [];
        for (scan in single_attributes) {
            if ((single_attributes[scan] === undefined) || (single_attributes[scan] === null)) {
                single_attributes[scan] = '';
                illegal.push(scan);
            }
        }
       for (scan in repeating_attributes) {
            if ((repeating_attributes[scan] === undefined) || (repeating_attributes[scan] === null)) {
                repeating_attributes[scan] = '';
                illegal.push(scan);
            }
        }
        if (illegal.length > 0) {
            log(`beyond: errors during import: the following imported attributes had undefined or null values: ${illegal}`);
        }

        // make work queue
        let items = createSingleWriteQueue(single_attributes);
        processItem(character, items, single_attributes, repeating_attributes, total_level)
    });
// End of on chat-msg process

// Begin remaining const declarations
    const createSingleWriteQueue = (attributes) => {
        // this is the list of trigger attributes that will trigger class recalculation, as of 5e OGL 2.5 October 2018
        // (see on... handler that calls update_class in sheet html)
        // these are written first and individually, since they trigger a lot of changes
        let class_update_triggers = [
            'class', // NOTE: MUST be first because of shift below
            'custom_class', 
            'cust_classname', 
            'cust_hitdietype', 
            'cust_spellcasting_ability', 
            'cust_spellslots', 
            'cust_strength_save_prof', 
            'cust_dexterity_save_prof', 
            'cust_constitution_save_prof', 
            'cust_intelligence_save_prof', 
            'cust_wisdom_save_prof', 
            'cust_charisma_save_prof', 
            'subclass', 
            'multiclass1', 
            'multiclass1_subclass', 
            'multiclass2', 
            'multiclass2_subclass', 
            'multiclass3', 
            'multiclass3_subclass'];

        // set class first, everything else is alphabetical
        let classAttribute = class_update_triggers.shift();
        class_update_triggers.sort();
        class_update_triggers.unshift(classAttribute);

        // write in deterministic order (class first, then alphabetical)
        let items = [];
        for (trigger of class_update_triggers) {
            let value = attributes[trigger];
            if ((value === undefined) || (value === null)) {
                continue;
            }
            items.push([trigger, value]);
            log('beyond: trigger attribute ' + trigger);
            delete attributes[trigger];
        }
        return items;
    }

    const processItem = (character, items, single_attributes, repeating_attributes, total_level) => {
        let nextItem = items.shift();

        // check if the write queue was empty
        if (nextItem === undefined) {
            // do one giant write for all the single attributes, before we create a bunch of attacks 
            // and other things that depend on stat changes
            setAttrs(object.id, single_attributes);

            // do one giant write for all the repeating attributes
            setAttrs(object.id, repeating_attributes);

            // configure HP, because we now know our CON score
            //loadHitPoints(character, total_level);

            if(class_spells.length > 0 && state[state_name][beyond_caller.id].config.imports.class_spells) {
                sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is almost ready.<br />Class spells are being imported over time.</div>', null, {noarchive:true});

                // this is really just artificially asynchronous, we are not currently using a worker, so it will happen as soon as we return
                onSheetWorkerCompleted(() => {
                    importSpells(character, class_spells);
                })
            } else {
                reportReady(character);
            }
            return
        }

        // create empty attribute if not already there
        let nextAttribute = findObjs({ type: 'attribute', characterid: object.id, name: nextItem[0] })[0];
        nextAttribute = nextAttribute || createObj('attribute', { name: nextItem[0], characterid: object.id });

        // async load next item
        onSheetWorkerCompleted(function() {
            processItem(character, items, single_attributes, repeating_attributes, total_level);
        });
        log('osrplus: ' + nextItem[0] + " = " + String(nextItem[1]));
        nextAttribute.setWithWorker({ current: nextItem[1] });
    }
    
    const calculateInitiativeStyle = (character) => {
        let init_mods = getObjects(character.modifiers, 'subType', 'initiative');
        let initadv = init_mods.some(im => im.type == 'advantage');
        let initdis = init_mods.some(im => im.type == 'disadvantage');
        if(initadv && !initdis) {
            return '{@{d6},@{d6}}kh1';
        }
        if(!initadv && initdis) {
            return '{@{d6},@{d6}}kl1';
        }
        return '@{d6}';
    }

    const reportReady = (character) => {
        // TODO this is nonsense.  we aren't actually done importing, because notifications in the character sheet are firing for quite a while
        // after we finish changing things (especially on first import) and we have no way (?) to wait for it to be done.   These are not sheet workers
        // on which we can wait.
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is ready at https://journal.roll20.net/character/' + object.id +'</div>', null, {noarchive:true});
    }
    
    const getFeatureSpells = (character, traitId, featureType) => {
        let spellsArr = [];
        if(character.spells[featureType] == null) return spellsArr;
        if(character.spells[featureType].length > 0) {
            let options = getObjects(character.options[featureType], 'componentId', traitId);
            for(let i = 0; i < options.length; i++) {
                let spells = getObjects(character.spells[featureType], 'componentId', options[i].definition.id);
                for(let j = 0; j < spells.length; j++) {
                    spellsArr.push(spells[j])
                }
            }
        }
        return spellsArr;
    };
  
    const importSpells = (character, spells) => {
        // set this to whatever number of items you can process at once
        // return attributes;
        spellAttacks = [];
        let chunk = 5;
        let index = 0;
        function doChunk() {
            let cnt = chunk;
            let attributes = {};
            while (cnt-- && index < spells.length) {
                Object.assign(attributes, importSpell(character, spells, index, true));
                ++index;
            }
            setAttrs(object.id, attributes);
            if (index < spells.length) {
                // set Timeout for async iteration
                onSheetWorkerCompleted(doChunk);
            } else {
                log('beyond: spells imported, updating spell attack proficiency');
                onSheetWorkerCompleted(() => { 
                    updateSpellAttackProf(character, 0); 
                });
            }
        }
        doChunk();
    };  

    const blankIfNull = (input) => {
        return (input === null)?"":input;
    }

    const ucFirst = (string) => {
        if(string == null) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    const sendConfigMenu = (player, first) => {
        let playerid = player.id;
        let prefix = (state[state_name][playerid].config.prefix !== '') ? state[state_name][playerid].config.prefix : '[NONE]';
        let prefixButton = makeButton(prefix, '!osrplus --config prefix|?{Prefix}', buttonStyle);
        let suffix = (state[state_name][playerid].config.suffix !== '') ? state[state_name][playerid].config.suffix : '[NONE]';
        let suffixButton = makeButton(suffix, '!osrplus --config suffix|?{Suffix}', buttonStyle);
        let overwriteButton = makeButton(state[state_name][playerid].config.overwrite, '!osrplus --config overwrite|'+!state[state_name][playerid].config.overwrite, buttonStyle);
        let debugButton = makeButton(state[state_name][playerid].config.debug, '!osrplus --config debug|'+!state[state_name][playerid].config.debug, buttonStyle);
        // let silentSpellsButton = makeButton(state[state_name][playerid].config.silentSpells, '!beyond --config silentSpells|'+!state[state_name][playerid].config.silentSpells, buttonStyle);

        let listItems = [
            '<span style="float: left; margin-top: 6px;">Overwrite:</span> '+overwriteButton+'<br /><small style="clear: both; display: inherit;">This option will overwrite an existing character sheet with a matching character name. I recommend making a backup copy just in case.</small>',
            '<span style="float: left; margin-top: 6px;">Prefix:</span> '+prefixButton,
            '<span style="float: left; margin-top: 6px;">Suffix:</span> '+suffixButton,
            '<span style="float: left; margin-top: 6px;">Debug:</span> '+debugButton,
            // '<span style="float: left; margin-top: 6px;">Silent Spells:</span> '+silentSpellsButton
        ]

        let list = '<b>Importer</b>'+makeList(listItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');

        let languageGroupingButton = makeButton(state[state_name][playerid].config.languageGrouping, '!osrplus --config languageGrouping|'+!state[state_name][playerid].config.languageGrouping, buttonStyle);
        let initTieBreakerButton = makeButton(state[state_name][playerid].config.initTieBreaker, '!osrplus --config initTieBreaker|'+!state[state_name][playerid].config.initTieBreaker, buttonStyle);
        let spellTargetInAttacksButton = makeButton(state[state_name][playerid].config.spellTargetInAttacks, '!osrplus --config spellTargetInAttacks|'+!state[state_name][playerid].config.spellTargetInAttacks, buttonStyle);

        let inPlayerJournalsButton = makeButton(player.get('displayname'), '', buttonStyle);
        let controlledByButton = makeButton(player.get('displayname'), '', buttonStyle);
        if(playerIsGM(playerid)) {
            let players = '';
            let playerObjects = findObjs({
                _type: "player",
            });
            for(let i = 0; i < playerObjects.length; i++) {
                players += '|'+playerObjects[i]['attributes']['_displayname']+','+playerObjects[i].id;
            }

            let ipj = state[state_name][playerid].config.inplayerjournals == '' ? '[NONE]' : state[state_name][playerid].config.inplayerjournals;
            if(ipj != '[NONE]' && ipj != 'all') ipj = getObj('player', ipj).get('displayname');
            inPlayerJournalsButton = makeButton(ipj, '!osrplus --config inplayerjournals|?{Player|None,[NONE]|All Players,all'+players+'}', buttonStyle);
            let cb = state[state_name][playerid].config.controlledby == '' ? '[NONE]' : state[state_name][playerid].config.controlledby;
            if(cb != '[NONE]' && cb != 'all') cb = getObj('player', cb).get('displayname');
            controlledByButton = makeButton(cb, '!osrplus --config controlledby|?{Player|None,[NONE]|All Players,all'+players+'}', buttonStyle);
        }

        let sheetListItems = [
            '<span style="float: left; margin-top: 6px;">In Player Journal:</span> '+inPlayerJournalsButton,
            '<span style="float: left; margin-top: 6px;">Player Control Permission:</span> '+controlledByButton,
            '<span style="float: left; margin-top: 6px;">Language Grouping:</span> '+languageGroupingButton,
            '<span style="float: left; margin-top: 6px;">Initiative Tie Breaker:</span> '+initTieBreakerButton,
            '<span style="float: left; margin-top: 6px;">Spell Info in Attacks:</span> '+spellTargetInAttacksButton
        ]

        let sheetList = '<hr><b>Character Sheet</b>'+makeList(sheetListItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');

        let debug = '';
        if(state[state_name][playerid].config.debug){
            let debugListItems = [];
            for(let importItemName in state[state_name][playerid].config.imports){
                let button = makeButton(state[state_name][playerid].config.imports[importItemName], '!osrplus --imports '+importItemName+'|'+!state[state_name][playerid].config.imports[importItemName], buttonStyle);
                debugListItems.push('<span style="float: left">'+importItemName+':</span> '+button)
            }

            debug += '<hr><b>Imports</b>'+makeList(debugListItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');
        }

        let resetButton = makeButton('Reset', '!osrplus --reset', buttonStyle + ' margin: auto; width: 90%; display: block; float: none;');

        let title_text = (first) ? script_name + ' First Time Setup' : script_name + ' Config';
        let text = '<div style="'+style+'">'+makeTitle(title_text)+list+sheetList+debug+'<hr>'+resetButton+'</div>';

        sendChat(script_name, '/w "' + player.get('displayname') + '" ' + text, null, {noarchive:true});
    };

    const sendHelpMenu = (player, first) => {
        // let configButton = makeButton('Config', '!beyond --config', buttonStyle+' margin: auto; width: 90%; display: block; float: none;');

        let listItems = [
            '<span style="text-decoration: underline; font-size: 90%;">!osrplus --help</span><br />Shows this menu.',
            '<span style="text-decoration: underline; font-size: 90%;">!osrplus --config</span><br />Shows the configuration menu. (GM only)',
            '<span style="text-decoration: underline; font-size: 90%;">!osrplus --import [CHARACTER JSON]</span><br />Imports a character from <a href="https://osrplus.com" target="_blank">OSR+</a>.',
        ];

        let command_list = makeList(listItems, 'list-style: none; padding: 0; margin: 0;');

        let text = '<div style="'+style+'">';
        text += makeTitle(script_name + ' Help');
        text += '<p>Open your character on <a href="https://osrplus.com" target="_blank">OSR+</a>, and ask DQ or Kris how to obtain the character ID.  Add this ID to the following link:  https://osrplus.com/api/roll20/?id=[CHARACTER_ID]. Copy the full contents of this page and paste it behind the command `!osrplus --import`.</p>';
        text += '<p>For more information take a look at my <a style="text-decoration: underline" href="https://github.com/ShamanGreeny/OSRPlusImporter/blob/main/OSRPlusImporter.js" target="_blank">Github</a> repository.</p>';
        text += '<hr>';
        text += '<b>Commands:</b>'+command_list;
        // text += '<hr>';
        // text += configButton;
        text += '</div>';

        sendChat(script_name, '/w "'+ player.get('displayname') + '" ' + text, null, {noarchive:true});
    };

    const makeTitle = (title) => {
        return '<h3 style="margin-bottom: 10px;">'+title+'</h3>';
    };

    const makeButton = (title, href, style) => {
        return '<a style="'+style+'" href="'+href+'">'+title+'</a>';
    };

    const makeList = (items, listStyle, itemStyle) => {
        let list = '<ul style="'+listStyle+'">';
        items.forEach((item) => {
            list += '<li style="'+itemStyle+'">'+item+'</li>';
        });
        list += '</ul>';
        return list;
    };

    const replaceChars = (text) => {
        text = text.replace('\&rsquo\;', '\'').replace('\&mdash\;','—').replace('\ \;',' ').replace('\&hellip\;','…');
        text = text.replace('\&nbsp\;', ' ');
        text = text.replace('\û\;','û').replace('’', '\'').replace(' ', ' ');
        text = text.replace(/<li[^>]+>/gi,'• ').replace(/<\/li>/gi,'');
        text = text.replace(/\r\n(\r\n)+/gm,'\r\n');
        return text;
    };

    const getRepeatingRowIds = (section, attribute, matchValue, index) => {
        let ids = [];
        if(state[state_name][beyond_caller.id].config.overwrite) {
            let matches = findObjs({ type: 'attribute', characterid: object.id })
                .filter((attr) => {
                    return attr.get('name').indexOf('repeating_'+section) !== -1 && attr.get('name').indexOf(attribute) !== -1 && attr.get('current') == matchValue;
                });
            for(let i in matches) {
                let row = matches[i].get('name').replace('repeating_'+section+'_','').replace('_'+attribute,'');
                ids.push(row);
            }
            if(ids.length == 0) ids.push(generateRowID());
        }
        else ids.push(generateRowID());

        if(index == null) return ids;
        else return ids[index] == null && index >= 0 ? generateRowID() : ids[index];
    }

    const getTotalAbilityScore = (character, scoreId) => {
        let index = scoreId-1;
        let base = (character.stats[index].value == null ? 10 : character.stats[index].value),
            bonus = (character.bonusStats[index].value == null ? 0 : character.bonusStats[index].value),
            override = (character.overrideStats[index].value == null ? 0 : character.overrideStats[index].value),
            total = base + bonus,
            modifiers = getObjects(character, '', _ABILITY[_ABILITIES[scoreId]] + "-score");
        if(override > 0) total = override;
        if(modifiers.length > 0) {
            let used_ids = [];
            for(let i = 0; i < modifiers.length; i++){
                if(modifiers[i].type == 'bonus' && used_ids.indexOf(modifiers[i].id) == -1) {
                    total += modifiers[i].value;
                    used_ids.push(modifiers[i].id);
                }
            }
        }

        return total;
    };

      //return an array of objects according to key, value, or key and value matching, optionally ignoring objects in array of names
    const getObjects = (obj, key, val, except) => {
        except = except || [];
        let objects = [];
        for (let i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                if (except.indexOf(i) != -1) {
                    continue;
                }
                objects = objects.concat(getObjects(obj[i], key, val));
            } else
            //if key matches and value matches or if key matches and value is not passed (eliminating the case where key matches but passed value does not)
            if (i == key && obj[i] == val || i == key && val == '') { //
                objects.push(obj);
            } else if (obj[i] == val && key == ''){
                //only add if the object is not already in the array
                if (objects.lastIndexOf(obj) == -1){
                    objects.push(obj);
                }
            }
        }
        return objects;
    };

    // Find an existing repeatable item with the same name, or generate new row ID
    const getOrMakeRowID = (character,repeatPrefix,name) => {
        // Get list of all of the character's attributes
        let attrObjs = findObjs({ _type: "attribute", _characterid: character.get("_id") });

        let i = 0;
        while (i < attrObjs.length)
        {
            // If this is a feat taken multiple times, strip the number of times it was taken from the name
            /*let attrName = attrObjs[i].get("current").toString();
             if (regexIndexOf(attrName, / x[0-9]+$/) !== -1)
             attrName = attrName.replace(/ x[0-9]+/,"");

             if (attrObjs[i].get("name").indexOf(repeatPrefix) !== -1 && attrObjs[i].get("name").indexOf("_name") !== -1 && attrName === name)
             return attrObjs[i].get("name").substring(repeatPrefix.length,(attrObjs[i].get("name").indexOf("_name")));
             i++;*/
            i++;
        }
        return generateRowID();
    };

    const generateUUID = (function() {
        let a = 0, b = [];
        return function() {
            let c = (new Date()).getTime() + 0, d = c === a;
            a = c;
            for (var e = new Array(8), f = 7; 0 <= f; f--) {
                e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                c = Math.floor(c / 64);
            }
            c = e.join("");
            if (d) {
                for (f = 11; 0 <= f && 63 === b[f]; f--) {
                    b[f] = 0;
                }
                b[f]++;
            } else {
                for (f = 0; 12 > f; f++) {
                    b[f] = Math.floor(64 * Math.random());
                }
            }
            for (f = 0; 12 > f; f++){
                c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
            }
            return c;
        };
    }());

    const generateRowID = function() {
        "use strict";
        return generateUUID().replace(/_/g, "Z");
    };

    const regexIndexOf = (str, regex, startpos) => {
        let indexOf = str.substring(startpos || 0).search(regex);
        return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
    };

    const pre_log = (message) => {
        log('---------------------------------------------------------------------------------------------');
        log(message);
        log('---------------------------------------------------------------------------------------------');
    };

    const checkInstall = function() {
        if(!_.has(state, state_name)){
            state[state_name] = state[state_name] || {};
        }
        setDefaults();
    };

    const setDefaults = (reset) => {
        const defaults = {
            overwrite: false,
            debug: false,
            prefix: '',
            suffix: '',
            inplayerjournals: '',
            controlledby: '',
            languageGrouping: false,
            initTieBreaker: false,
            spellTargetInAttacks: true,
            imports: {
                classes: true,
                class_spells: true,
                class_traits: true,
                inventory: true,
                proficiencies: true,
                traits: true,
                languages: true,
                bonuses: true,
                notes: true,
            }
        };

        let playerObjects = findObjs({
            _type: "player",
        });
        playerObjects.forEach((player) => {
            if(!state[state_name][player.id]) {
                state[state_name][player.id] = {};
            }

            if(!state[state_name][player.id].config) {
                state[state_name][player.id].config = defaults;
            }

            for(let item in defaults) {
                if(!state[state_name][player.id].config.hasOwnProperty(item)) {
                    state[state_name][player.id].config[item] = defaults[item];
                }
            }

            for(let item in defaults.imports) {
                if(!state[state_name][player.id].config.imports.hasOwnProperty(item)) {
                    state[state_name][player.id].config.imports[item] = defaults.imports[item];
                }
            }

            if(!state[state_name][player.id].config.hasOwnProperty('firsttime')){
                if(!reset){
                    sendConfigMenu(player, true);
                }
                state[state_name][player.id].config.firsttime = false;
            }
        });
    };

    const importClassOptions = (repeating_attributes, trait, current_class, class_options, repeat_index) => {
        if(trait.requiredLevel > current_class.level) {
            // not applied to this character, trait is available at higher levels
            return repeat_index;
        }

        // search for selected options for the given trait
        let selections = getObjects(class_options, 'componentId', trait.id);
        if (selections.length < 1) {
            // no selections, ignore trait
            return repeat_index;
        }

        let index = repeat_index;
        for (selection of selections) {
            let text = replaceChars(`${selection.definition.description}`);
            let trait_docs = {
                name: selection.definition.name,
                description: text,
                source: 'Class',
                source_type: current_class.definition.name
            }        
            Object.assign(repeating_attributes, createRepeatingTrait(object, trait_docs, index++));
        }
        return index;
    };

    const emitAttributesForModifiers = (single_attributes, repeating_attributes, modifiers, total_level) => {
        let basenames = Object.keys(modifiers);
        basenames.sort();
        // for half proficiency types, we have to set a constant that is only valid for the current level, because
        // the 5e OGL sheet does not understand these types of proficiency
        let proficiency_bonus = (Math.floor((total_level - 1) / 4) + 2);
        for (let basename of basenames) {
            let modifier = modifiers[basename];
            let mod = 0;
            if (modifier.bonus !== undefined) {
                mod = modifier.bonus;
            }
            log(`beyond: final modifier ${basename} (${modifier.friendly}) proficiency ${modifier.proficiency} bonus ${modifier.bonus}`)
            if (all_skills.indexOf(basename) !== -1) {
                switch (modifier.proficiency) {
                    case 0:
                        // no proficiency
                        break;
                    case 1:
                        single_attributes[`${basename}_prof`] = '';
                        single_attributes[`${basename}_flat`] = mod+ Math.floor(proficiency_bonus / 2);
                        break;
                    case 2:
                        single_attributes[`${basename}_prof`] = '';
                        single_attributes[`${basename}_flat`] = mod + Math.ceil(proficiency_bonus / 2);
                        break;
                    case 3:
                        single_attributes[`${basename}_prof`] = `(@{pb}*@{${basename}_type})`;
                        if (mod !== 0) {
                            single_attributes[`${basename}_flat`] = mod;
                        }
                        break;
                    case 4:
                        single_attributes[`${basename}_prof`] = `(@{pb}*@{${basename}_type})`;
                        single_attributes[`${basename}_type`] = 2;
                        if (mod !== 0) {
                            single_attributes[`${basename}_flat`] = mod;
                        }
                        break;                        
                }
            } else if (saving_throws.indexOf(basename) !== -1) {
                switch (modifier.proficiency) {
                    case 0:
                        // no proficiency
                        break;
                    case 1:
                        single_attributes[`${basename}_prof`] = '';
                        single_attributes[`${basename}_mod`] = mod+ Math.floor(proficiency_bonus / 2);
                        break;
                    case 2:
                        single_attributes[`${basename}_prof`] = '';
                        single_attributes[`${basename}_mod`] = mod + Math.ceil(proficiency_bonus / 2);
                        break;
                    case 3:
                        single_attributes[`${basename}_prof`] = `(@{pb})`;
                        if (mod !== 0) {
                            single_attributes[`${basename}_mod`] = mod;
                        }
                        break;
                    case 4:
                        // this case probably does not exist in the 5e rules, but we can at least support
                        // it in the constant for current level style
                        single_attributes[`${basename}_prof`] = '(@{pb})';
                        single_attributes[`${basename}_mod`] = proficiency_bonus + mod;
                        break;                        
                } 
            } else if (modifier.proficiency > 0) {
                // general proficiency 
                let type = 'OTHER';
                if (basename.includes('weapon')) {
                    type = 'WEAPON';
                } else if (basename.includes('armor')) {
                    type = 'ARMOR';
                } else if (basename.includes('shield')) {
                    type = 'ARMOR';
                } else if (weapons.indexOf(modifier.friendly) !== -1) {
                    type = 'WEAPON';
                }
                let row = getRepeatingRowIds('proficiencies', 'name', modifier.friendly)[0];
                repeating_attributes["repeating_proficiencies_" + row + "_name"] = modifier.friendly;
                repeating_attributes["repeating_proficiencies_" + row + "_prof_type"] = type; 
                repeating_attributes["repeating_proficiencies_" + row + "_options-flag"] = '0'; // XXX why is this set as string?
            }
            // XXX implement passive-perception bonus ('passiveperceptionmod') etc.
        }
    }; 
    
    

})();


