///<reference path="../globals.ts" />
/* ------------
     CPU.ts

     Requires global.ts.

     Routines for the host CPU simulation, NOT for the OS itself.
     In this manner, it's A LITTLE BIT like a hypervisor,
     in that the Document environment inside a browser is the "bare metal" (so to speak) for which we write code
     that hosts our client OS. But that analogy only goes so far, and the lines are blurred, because we are using
     TypeScript/JavaScript in both the host and client environments.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */
var TSOS;
(function (TSOS) {
    var Cpu = (function () {
        function Cpu(PC, Acc, Xreg, Yreg, Zflag, isExecuting) {
            if (PC === void 0) { PC = 0; }
            if (Acc === void 0) { Acc = 0; }
            if (Xreg === void 0) { Xreg = 0; }
            if (Yreg === void 0) { Yreg = 0; }
            if (Zflag === void 0) { Zflag = 0; }
            if (isExecuting === void 0) { isExecuting = false; }
            this.PC = PC;
            this.Acc = Acc;
            this.Xreg = Xreg;
            this.Yreg = Yreg;
            this.Zflag = Zflag;
            this.isExecuting = isExecuting;
        }
        Cpu.prototype.init = function () {
            this.PC = 0;
            this.Acc = 0;
            this.Xreg = 0;
            this.Yreg = 0;
            this.Zflag = 0;
            this.isExecuting = false;

            updateCpu();
        };

        // Cycle function
        // Each cycle, executeProgram is called with the parameter of the next part in memory containing program information
        // Calls HTML update methods
        Cpu.prototype.cycle = function () {
            _Kernel.krnTrace('CPU cycle');
            // TODO: Accumulate CPU usage and profiling statistics here.
            this.executeProgram(_MemoryManager.memory.storedData[this.PC]);

            updateCpu();
            updatePcb();
            this.updatePcbVals();
            updateMemory(_MemoryManager.memory);
    };

        // Execute program function
        // Gets called on every CPU cycle with the hex code to be translated by the OP codes and printed
        // Utilizes an if to ensure the CPU does not execute any extra unused memory.
        // When complete, sets execution state to false to stop the cpu execution.
        Cpu.prototype.executeProgram = function (hex){

                switch(hex) {
                    case "A9":
                        // load acc with constant
                     this.loadAccConstant();
                     break;
                    case "AD":
                    // load acc from memory
                    this.loadAccFromMemory();
                        break;
                    case "8D":
                    // store acc in memory
                    this.storeAccInMemory();
                        break;
                    case "6D":
                    // add with carry
                        this.addWithCarry();
                        break;
                    case "A2":
                    // load xreg with constant
                        this.loadXregConstant();
                        break;
                    case "AE":
                    //load xreg from mem
                        this.loadXregFromMemory();
                        break;
                    case "A0":
                    // load yreg with constant
                        this.loadYregConstant();
                        break;
                    case "AC":
                    // load yreg from memory
                        this.loadYregFromMemory();
                        break;
                    case "EA":
                    // no operation
                        break;
                    case "00":
                        this.break();
                        break;
                    case "EC":
                    // compare byte in memory to xreg, sets zflag if equal
                        this.compare();
                        break;
                    case "D0":
                    // branch n bytes if z flag = 0
                        this.branch();
                        break;
                    case "EE":
                    // increment value of a byte
                        this.incrementByte();
                        break;
                    case "FF":
                        this.systemCall();
                        break;
                    default:
                        //unknown op code
                        break;
                }
                this.PC++;

        };

        // Loads the constant into the accumulator from memory (converts it too)
        Cpu.prototype.loadAccConstant = function(){
            this.Acc = this.convert(_MemoryManager.memory.storedData[++this.PC]);
        };
        // Loads the constant from memory into the accumulator
        Cpu.prototype.loadAccFromMemory = function(){
            this.Acc = this.getData(this.getMemoryAddress());
        };

        // Stores acc in memory using the insertData function
        Cpu.prototype.storeAccInMemory = function(){
            _MemoryManager.insertData(this.Acc.toString(16), this.getMemoryAddress());
        };

        // Adds the acc to a specified constant in memory
        Cpu.prototype.addWithCarry = function(){
            this.Acc = this.Acc + this.convert(this.getData(this.getMemoryAddress()));
        };

        // Loads the constant into the xreg from memory (converts it too)
        Cpu.prototype.loadXregConstant = function(){
            this.Xreg = this.convert(_MemoryManager.memory.storedData[++this.PC]);
        };

        // Loads the constant from memory into the xreg
        Cpu.prototype.loadXregFromMemory = function(){
            this.Xreg = this.getData(this.getMemoryAddress());
        };

        // Loads the constant into the yreg from memory (converts it too)
        Cpu.prototype.loadYregConstant = function(){
            this.Yreg = this.convert(_MemoryManager.memory.storedData[++this.PC]);
        };

        // Loads the constant from memory into the yreg
        Cpu.prototype.loadYregFromMemory = function(){
            this.Yreg = this.getData(this.getMemoryAddress());
        };

        // Converts hex into base 10
        Cpu.prototype.convert = function (hex){
            return parseInt(hex, 16);
        };

        // getMemoryAddress
        // Takes the next two instructions and flips them, then converts them to base 10 and returns
        // When getting the instructions, this.PC increments so they are not referenced on the next cycle
        Cpu.prototype.getMemoryAddress = function(){
            // Get the next two location inputs
            var firstLoc = _MemoryManager.memory.storedData[++this.PC];
            var secondLoc = _MemoryManager.memory.storedData[++this.PC];
            // Flip the two inputs to create the memory address
            var location = (secondLoc + firstLoc);
            return this.convert(location);
        };

        // Gets the data from a location in the storedData array
        Cpu.prototype.getData = function (location){
            return _MemoryManager.memory.storedData[location];
        };

        // Break function sends interrupt and updates everything before terminated the process
        Cpu.prototype.break = function (){
            this.updatePcbVals();
            updateCpu();
            updatePcb();
            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(CPU_BREAK))
        };

        // Updates the Pcb values with the CPU values
        Cpu.prototype.updatePcbVals = function (){
            _CurrentProgram.PC = this.PC;
            _CurrentProgram.Acc = this.Acc;
            _CurrentProgram.Xreg = this.Xreg;
            _CurrentProgram.Yreg = this.Yreg;
            _CurrentProgram.Zflag = this.Zflag;
            _CurrentProgram.state = "Terminated";
        };

        // Compares a value to the xreg, if true sets the Zflag to 1
        Cpu.prototype.compare = function (){
            var valueFromMem = this.getData(this.getMemoryAddress());
            if(parseInt(this.Xreg) === parseInt(valueFromMem)){
                this.Zflag = 1;
            } else {
                this.Zflag = 0;
            }
        };

        // SUPPOSED TO BRANCH BUT IT WONT
        Cpu.prototype.branch = function (){
            if(this.Zflag === 0){
                this.PC +=  this.convert(this.getData(++this.PC)) + 1;
            } else {
                ++this.PC;
            }
        };

        // Incrememnts byte at a given address by 1
        Cpu.prototype.incrementByte = function (){
            var location = this.getMemoryAddress();
            var byteValue = this.convert(this.getData(location));
            byteValue++;
            _MemoryManager.insertData(byteValue.toString(16), location);
        };

        Cpu.prototype.systemCall = function (){
          _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SYS_CALL));
        };

        // Completed process ending function calls etc
        Cpu.prototype.terminated = function (){
            this.init();
            _StdOut.putText("Execution complete.");
            _StdOut.advanceLine();
            _StdOut.putText(_OsShell.promptStr);
        };

        return Cpu;
    })();
    TSOS.Cpu = Cpu;
})(TSOS || (TSOS = {}));
