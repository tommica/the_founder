import _ from 'underscore';
import config from 'config';
import util from 'util';
import AI from './ai/AI';
import Tile from './Tile';
import Piece from './Piece';
import Board from './Board';
import Player from './Player';
import Product from 'game/Product';
import Competitor from 'game/Competitor';
import socialMediaHandles from 'data/influencers.json'

const socialMediaTitles = ['Thought Leader', 'Social Media Star', 'Internet Sensation', 'Celeb'];

function createPieces(player, product) {
  var quantity = Product.levels.quantity[product.levels.quantity],
      strength = Product.levels.strength[product.levels.strength],
      movement = Product.levels.movement[product.levels.movement];

  return _.times(quantity, function() {
    return new Piece.Product(player, product, strength, movement);
  });
}

class Market {
  constructor(product, player, game, debug) {
    this.product = product;
    this.player = player;
    this.totalTurns = config.MAX_TURNS;
    this.turnsLeft = this.totalTurns;

    var competitor = _.sample(_.filter(player.competitors, c => !c.disabled));
    var competitorProduct = Competitor.createProduct(product, competitor);

    this.players = [
      new Player(player.company, true, 0x1C1FE8),
      new Player(competitor, false, 0xF7202F)
    ];

    this.humanPlayer = this.players[0];
    this.aiPlayer = this.players[1];

    createPieces(this.humanPlayer, product);
    createPieces(this.aiPlayer, competitorProduct);

    this.board = new Board(player.company, this.players, game);
    this.AI = new AI(this.board, this.aiPlayer);
    this.board.onHumanDone = this.endTurn.bind(this);

    if (debug) {
      this.board.debug();
    }

    // setup income tile descriptions
    _.each(this.board.incomeTiles, function(t) {
      t.description = `Capture cost: ${t.baseCost}<br>Generates ${util.formatCurrency(Product.marketShareToRevenue(t.income, product))} revenue`;
    });

    // setup influencer tile names
    var handles = _.shuffle(socialMediaHandles);
    _.each(this.board.influencerTiles, function(t) {
      t.name = `${handles.pop()}<h6>${_.sample(socialMediaTitles)}</h6>`;
    });

    this.totalIncome = _.reduce(this.board.incomeTiles, function(m, tile) {
      return m + tile.income + 1;
    }, 0);
  }

  percentMarketShare() {
    var shares = {human: 0, ai: 0},
        total = 0,
        self = this;
    _.each(this.board.incomeTiles, function(tile) {
      var income = tile.income + 1;
      if (tile.owner == self.humanPlayer) {
        shares.human += income;
      } else if (tile.owner == self.aiPlayer) {
        shares.ai += income;
      }
    });
    shares.human = (shares.human/this.totalIncome) * 100;
    shares.ai = (shares.ai/this.totalIncome) * 100;
    return shares;
  }

  shouldEndGame() {
    return (this.turnsLeft <= 0 || this.board.uncapturedTiles.length == 0 || (this.aiPlayer.pieces.length == 0 || this.humanPlayer.pieces.length == 0));
  }

  endTurn() {
    this.turnsLeft--;
    this.board.unhighlightTiles();
    if (this.shouldEndGame()) {
      this.endGame();
    } else {
      var self = this;
      this.startTurn(this.aiPlayer);
      this.AI.takeTurn(function() {
        // add a little delay
        // otherwise transition is too fast
        setTimeout(function() {
          self.startTurn(self.humanPlayer)
          if (self.shouldEndGame()) {
            self.endGame();
          }
        }, 1200);
      });
    }
  }

  startTurn(player) {
    // reset moves
    _.each(player.pieces, p => p.reset());
    this.currentPlayer = player;
    this.onStartTurn();
  }
}

export default Market;