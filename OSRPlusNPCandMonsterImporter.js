/*
 * Version 0.1
 *
 * Made By Kris Parsons
 * Discord: kris0918
 * Github: 
 * Paypal.me: https://www.paypal.me/kristianparsons
 *
 *  To use - search for "data-hero" in view page source:
 * 
 *  NPC Example (Caster): https://osrplus.com/api/roll20_shorthand/?id=43116
 *  NPC Example (Martial):
 * 
 */

(function() {
    let osrp_caller = {};
    let object;

      // Styling for the chat responses.
    const style = "margin-left: 0px; overflow: hidden; background-color: #fff; border: 1px solid #000; padding: 5px; border-radius: 5px;";
    const buttonStyle = "background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; float: right;"
    
    const script_name = 'OSRPlusNPCandMonsterImporter';
    const state_name = 'OSRPLUSNPCANDMONSTERIMPORTER';
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
  

        // BEGIN JSON IMPORT PROCESS

        let json = importData;
        let character = JSON.parse(json).data;

        //Roll20 specific function - report to chat
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.shorthand.name + '</b> is starting.</div>', null, {noarchive:true});

        class_spells = [];

        // these are automatically sorted into attributes that are written individually, in alphabetical order
        // and other attributes that are then written as a bulk write, but all are written before repeating_attributes
        let single_attributes = {};

        // these are written in one large write once everything else is written
        // NOTE: changing any stats after all these are imported would create a lot of updates, so it is
        // good that we write these when all the stats are done
        let repeating_attributes = {};

        // First attempt to write items to the non-character sheet values of the object
        // let character_attributes = {};

        object = null;
  
        // Remove characters with the same name if overwrite is enabled.
        if(state[state_name][osrp_caller.id].config.overwrite) {
            let objects = findObjs({
                _type: "character",
                name: state[state_name][osrp_caller.id].config.prefix + character.shorthand.name + state[state_name][osrp_caller.id].config.suffix
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
                name: state[state_name][osrp_caller.id].config.prefix + character.shorthand.name + state[state_name][osrp_caller.id].config.suffix,
                inplayerjournals: playerIsGM(msg.playerid) ? state[state_name][osrp_caller.id].config.inplayerjournals : msg.playerid,
                controlledby: playerIsGM(msg.playerid) ? state[state_name][osrp_caller.id].config.controlledby : msg.playerid
            });
        }

        let attributes = {};   


        // Check for maleficence
        // TODO: Secondary Maleficence
        if (character.model.has_maleficence = true) {
            Object.assign(single_attributes, {
            'maleficence' : character.model.object_maleficence.post_title,
            'maleficence_description': character.model.object_maleficence.post_content
            })
        };

        // Abilities and NPC Perks
        // Languages
        var langList = ""
        for (const langKey in character.shorthand.languages){
            const langObject = character.shorthand.languages[langKey];
            for (const langName in langObject){
                if (langName == "post_title"){ 
                    //sendChat(script_name, 'Language: '+langObject[langName], null, {noarchive:true});
                    langList = langList.concat(langObject[langName])+", "
                }                
            }            
        };  
        langList = langList.substring(0, (langList.length-2));

        // Skills
        var skillsList = ""
        for (const skillKey in character.model.object_skills){
            const skillObject = character.model.object_skills[skillKey];
            for (const skillName in skillObject){
                if (skillName == "post_title"){ 
                    //sendChat(script_name, 'Language: '+langObject[langName], null, {noarchive:true});
                    skillsList = skillsList.concat(skillObject[skillName])+", "
                }                
            }            
        };  
        skillsList = skillsList.substring(0, (skillsList.length-2));

       
        /*
        // Spells
        let spells = character.spellbook.length;
        for (var i=0; i<spells; i++){
            for (var id in character.spellbook[i]){
            var row = i+1;
            attributes["spell"+row] = character.spellbook[i].post_title,
            attributes["spell"+row+"_desc"] = character.spellbook[i].post_content,
            attributes["spell"+row+"_attribute_name"] = character.spellbook[i].attribute_name,
            attributes["spell"+row+"_attribute_mod"] = character.spellbook[i].attribute_modifier,
            attributes["spell"+row+"_proficiency_name"] = character.spellbook[i].spell_category.name,
            attributes["spell"+row+"_proficiency_mod"] = character.spellbook[i].skill_modifier
            }
        }

        // Equipped Weapons and Armor
        var Armor = character.equipped_armor.Armor.length;
        for (var i=0; i<Armor; i++){
                    attributes["armor_equipped"] = character.object_equipped.Armor[i].post_title
        }
        var Weapon = character.object_equipped.Weapons.length
        for (var i=0; i<Weapon; i++){
            var row = i+1
            attributes["weapon"+row+"_equipped"] = character.object_equipped.Weapons[i].post_title
        }

        */

        // Add the iterated values thus far
        Object.assign(single_attributes, attributes);

        // Static or single value attributes
            let other_attributes = {
            
            // TEST AREA 
            //'Skill_Athletics_Prof': 'yes',

            // Base Info
            'character_quote':character.model.catchphrase,
            'monster_type':character.shorthand.monster_type,
            'equipped_armor':character.shorthand.equipped_armor.label,
            'ethos': character.shorthand.ethos,
            'morale':character.shorthand.morale,
            'npc_attack_pattern': character.shorthand.npc_attack_pattern,
            'level': character.model.level,
            'sheet_image' : character.model.avatar_local,

            
            // Ability Scores
            'mighty': character.shorthand.mighty,
            'deft': character.shorthand.deft,
            'smart': character.shorthand.smart,
            
            // Modifiers
            'defense': character.shorthand.def,
            'soak': character.shorthand.soak,
            'init': character.model.modifier_initiative,
            
            // Current Status
            'hp': character.shorthand.hp,
            'ap': character.shorthand.ap,
            'mp': character.shorthand.mp,
            'fp': character.shorthand.fp,

            // Comma separated values
            'languageGrouping': langList,
            'skillsGrouping': skillsList
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

        // Inventory loop and repeating items

        let reapeatingItems ={}


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
            log(`OSRPlus Import: errors during import: the following imported attributes had undefined or null values: ${illegal}`);
        }

        // make work queue
        let items = createSingleWriteQueue(single_attributes);
        processItem(character, items, single_attributes, repeating_attributes)
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
            log('OSRPlus: trigger attribute ' + trigger);
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

            if(class_spells.length > 0 && state[state_name][osrp_caller.id].config.imports.class_spells) {
                sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.shorthand.name + '</b> is almost ready.<br />Class spells are being imported over time.</div>', null, {noarchive:true});

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
    
    const reportReady = (character) => {
        // TODO this is nonsense.  we aren't actually done importing, because notifications in the character sheet are firing for quite a while
        // after we finish changing things (especially on first import) and we have no way (?) to wait for it to be done.   These are not sheet workers
        // on which we can wait.
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.shorthand.name + '</b> is ready at https://journal.roll20.net/character/' + object.id +'</div>', null, {noarchive:true});
    }
    
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
                log('OSRPlus: spells imported, updating spell attack proficiency');
                onSheetWorkerCompleted(() => { 
                    updateSpellAttackProf(character, 0); 
                });
            }
        }
        doChunk();
    };  

    const sendConfigMenu = (player, first) => {
        let playerid = player.id;
        let prefix = (state[state_name][playerid].config.prefix !== '') ? state[state_name][playerid].config.prefix : '[NONE]';
        let prefixButton = makeButton(prefix, '!osrplus --config prefix|?{Prefix}', buttonStyle);
        let suffix = (state[state_name][playerid].config.suffix !== '') ? state[state_name][playerid].config.suffix : '[NONE]';
        let suffixButton = makeButton(suffix, '!osrplus --config suffix|?{Suffix}', buttonStyle);
        let overwriteButton = makeButton(state[state_name][playerid].config.overwrite, '!osrplus --config overwrite|'+!state[state_name][playerid].config.overwrite, buttonStyle);
        let debugButton = makeButton(state[state_name][playerid].config.debug, '!osrplus --config debug|'+!state[state_name][playerid].config.debug, buttonStyle);

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

    const checkInstall = function() {
        if(!_.has(state, state_name)){
            state[state_name] = state[state_name] || {};
        }
        setDefaults();
    };

    const setDefaults = (reset) => {
        const defaults = {
            overwrite: true,
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

   
    
    

})();


