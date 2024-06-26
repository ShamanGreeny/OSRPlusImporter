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
 *  NPC Example (Caster): https://osrplus.com/api/roll20/?id=43116
 *  NPC Example (Martial): https://osrplus.com/api/roll20/?id=45320
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

    const MightSymbol = '\u{24C2}';
    const SmartSymbol = '\u{24C8}';
    const DeftSymbol = '\u{24B9}';
    //const bulletSymbol ='\u{25CF}';
    
    const attributeSymbols = {
      'mighty': MightSymbol,
      'smart': SmartSymbol,
      'deft': DeftSymbol
    };
 
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
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is starting.</div>', null, {noarchive:true});

        class_spells = [];

        // these are automatically sorted into attributes that are written individually, in alphabetical order
        // and other attributes that are then written as a bulk write, but all are written before repeating_attributes
        let single_attributes = {};

        // these are written in one large write once everything else is written
        // NOTE: changing any stats after all these are imported would create a lot of updates, so it is
        // good that we write these when all the stats are done
        let repeating_attributes = {};
        let attributes = {};

        // First attempt to write items to the non-character sheet values of the object
        // let character_attributes = {};

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
        };

        // Check for maleficence
        // TODO: Secondary Maleficence
        if (character.has_maleficence = true) {
            Object.assign(single_attributes, {
            'maleficence' : character.object_maleficence.post_title,
            'maleficence_description': character.object_maleficence.post_content
            })
        };

        // Ethos
        var ethosString = extractSingleObjectDetails(character.ethos, ['post_title'], '[post_title]');


        // Languages        
        var langList = extractDetails(character.object_languages, ['post_title'],'[post_title]');

        // Skills 
        var objectName = 'object_skills';
        var objectArray = character[objectName];
        var row=1

        if (objectArray && Array.isArray(objectArray)) {
            for (let index = 0; index < objectArray.length; index++) {

                const formattedString = getFormattedObjectString(character, objectName, index, '[post_title] +[modifier] [attribute]');
                if (formattedString) {
                    attributes["repeating_skills_"+row+"_skillname"] = formattedString;
                }

                const formattedDesc = getFormattedObjectString(character, objectName, index, '[post_content]');
                if (formattedDesc) {
                    attributes["repeating_skills_"+row+"_skilldesc"] = formattedDesc;
                }
                row=row+1
            }
        };   

        // Spells
        var objectName = 'spellbook';
        var objectArray = character[objectName];
        var row=1

        if (objectArray && Array.isArray(objectArray)) {
            for (let index = 0; index < objectArray.length; index++) {

                const formattedString = getFormattedObjectString(character, objectName, index, '[post_title] +[attribute_modifier] [attribute_name]');
                if (formattedString) {
                    attributes["repeating_spells_"+row+"_spellname"] = formattedString;
                }

                const formattedDesc = getFormattedObjectString(character, objectName, index, '[post_content]');
                if (formattedDesc) {
                    attributes["repeating_spells_"+row+"_spelldesc"] = formattedDesc;
                }
                row=row+1
            }
        };   

        // Stances
        var objectName = 'object_stances';
        var objectArray = character[objectName];
        var row=1

        if (objectArray && Array.isArray(objectArray)) {
            for (let index = 0; index < objectArray.length; index++) {

                const formattedString = getFormattedObjectString(character, objectName, index, '[post_title] ([stance_type])');
                if (formattedString) {
                    attributes["repeating_stances_"+row+"_stancename"] = formattedString;
                }

                const formattedDesc = getFormattedObjectString(character, objectName, index, '[post_content]');
                if (formattedDesc) {
                    attributes["repeating_stances_"+row+"_stancedesc"] = formattedDesc;
                }
                row=row+1
            }
        };   

        // Abilities and NPC Perks
        const { object_kit, object_perks } = character;
        row = 1

        if (object_kit && object_kit.post_title) {
            attributes["repeating_abilities_"+row+"_abilityname"] = object_kit.post_title+' (Kit)';
        }
        if (object_kit && object_kit.post_content) {
            attributes["repeating_abilities_"+row+"_abilitydesc"] = object_kit.post_content;
        }
        
        row=row+1
      
        if (object_perks && Array.isArray(object_perks)) {
            object_perks.forEach(perk => {
                if (perk.post_title) {
                    attributes["repeating_abilities_"+row+"_abilityname"] = perk.post_title+' (Perk)';
                }
                if (perk.post_content){
                    attributes["repeating_abilities_"+row+"_abilitydesc"] = perk.post_content;
                }

                row=row+1
          });
        };


        // Class Technique
        // TODO: Need example

        // Custom Perks
        // TODO: May need to include this in the iteration portion, writing to attributes
        // if character.model.custom_perks_raw == 'true'

        // Attacks
        // TODO


        // Add the iterated values thus far
        Object.assign(repeating_attributes, attributes)

        // Static or single value attributes
            let other_attributes = {
            
            // TEST AREA 
            //'Skill_Athletics_Prof': 'yes',

            // Base Info
            'character_quote':character.catchphrase,
            'monster_type':character.monster_type_label,
            'equipped_armor':character.modifier_ap_armor.label,
            'ethos': ethosString,
            'morale':character.morale.label,
            'npcattackpattern': character.npc_attack_pattern,
            'level': character.level,
            'sheet_image' : character.avatar_local,

            
            // Ability Scores
            'mighty': character.mighty_modified,
            'deft': character.deft_modified,
            'smart': character.smart_modified,
            
            // Modifiers
            'defense': character.defense,
            'soak': character.soak,
            'init': character.modifier_initiative,
            
            // Current Status
            'hp': character.hp,
            'ap': character.ap,
            'mp': character.mp,

            // Comma separated values
            'languageGrouping': langList
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
            log(`OSRPlus Import: errors during import: the following imported attributes had undefined or null values: ${illegal}`);
        }

        // make work queue
        let items = createSingleWriteQueue(single_attributes);
        processItem(character, items, single_attributes, repeating_attributes)
    });
// End of on chat-msg process

// Begin remaining const declarations
    const extractDetails = (data, items, format) => {
        let details = [];

        const processObject = (obj) => {
            let formattedString = format;
            items.forEach(item => {
            let value = item === 'attribute' && attributeSymbols[obj[item]] ? attributeSymbols[obj[item]] : obj[item];
            formattedString = formattedString.replace(`[${item}]`, value);
            });
            return formattedString;
        };

        if (Array.isArray(data)) {
            data.forEach(obj => details.push(processObject(obj)));
        } else if (typeof data === 'object' && data !== null) {
            for (let key in data) {
            if (data.hasOwnProperty(key)) {
                if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
                details.push(processObject(data[key]));
                }
            }
            }
        }

        return details.join(', ');
    };

    const extractSingleObjectDetails = (obj, items, format) => {
        let formattedString = format;
        items.forEach(item => {
          let value = item === 'attribute' && attributeSymbols[obj[item]] ? attributeSymbols[obj[item]] : obj[item];
          formattedString = formattedString.replace(`[${item}]`, value);
        });
        return formattedString;
      };
 
    const getFormattedObjectString = (json, objectName, index, format) => {
        const objectArray = json[objectName];
      
        if (objectArray && Array.isArray(objectArray) && objectArray[index]) {
          const obj = objectArray[index];
          let formattedString = format;
      
            // Replace placeholders with actual values from the object
            formattedString = formattedString.replace(/\[([^\]]+)\]/g, (_, key) => {
                if (key === 'attribute' && obj[key]) {
                    return attributeSymbols[obj[key]] || obj[key];
                }
                return obj[key] || '';
            });
        
            return formattedString;
            
            }
      
        return null;
      };
      

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

                reportReady(character);

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
        sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is ready at https://journal.roll20.net/character/' + object.id +'</div>', null, {noarchive:true});
    }
    

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


