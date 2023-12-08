import React, {MutableRefObject, useEffect, useRef, useState} from "react";
import styles from "./Board.module.scss";
import {BoardLettersByNumber, Colors, FigureData, Figures} from "types";
import Cell from "./Cell";
import Figure from "components/Figure/Figure";
import {
	changeFigurePosition,
	removeFigure,
	selectColor,
	selectFigures,
	selectGameWon, setGameStarted,
	setGameWon
} from "redux/gameSlice";
import {useAppDispatch, useAppSelector} from "redux/hooks";
import store from "../../redux/store";
import {Link} from "react-router-dom";

const Board: React.FC = () => {
	const dispatch = useAppDispatch();
	const gameColor = useAppSelector(selectColor);
	const figures = useAppSelector(selectFigures);
	const gameWon = useAppSelector(selectGameWon);
	let [isKingInCheck, setIsKingInCheck] = useState<boolean>(false);
	let dangerousCells: MutableRefObject<{
		white: { [key: string]: boolean };
		black: { [key: string]: boolean }
	}> = useRef({white: {}, black: {}});

	const sides = {
		ally: gameColor,
		enemy: gameColor === Colors.WHITE ? Colors.BLACK : Colors.WHITE,
	}

	const boardRef = useRef<HTMLDivElement>(null);
	const [choseFigurePos, setChoseFigurePos] = useState<{
		figure: FigureData
		availableCells: { [key: string]: boolean }
	} | null>(null);

	const cellsFigure: { [key: string]: FigureData | null } = {}

	const isAvailableCellForMove = (x: number, y: number): boolean => {
		if (choseFigurePos && choseFigurePos.availableCells[`${x}-${y}`]) {
			return true;
		}
		return false;
	}

	const isCellHavingFigure = (x: number, y: number): boolean => {
		return cellsFigure[`${x}-${y}`] ? true : false;
	}

	const moveOn = (figure: FigureData, x: number, y: number) => {
		cellsFigure[`${figure.x}-${figure.y}`] = null;
		cellsFigure[`${x}-${y}`] = figure;
		dispatch(changeFigurePosition({figure, x, y}));
		setChoseFigurePos(null);
	}

	const cellClicked = (x: number, y: number): void => {
		if (!choseFigurePos) return;
		if (!choseFigurePos.availableCells[`${x}-${y}`]) return;

		moveOn(choseFigurePos.figure, x, y);
		nextAIMoveDelayed();
	}

	const initCells = (): JSX.Element[] => {
		const cells: JSX.Element[] = [];
		for (let y = 8; y >= 1; y--) {
			for (let x = 1; x <= 8; x++) {
				cellsFigure[`${x}-${y}`] = null;
				const boardLetter = BoardLettersByNumber[x];
				if ((y + x) % 2 === 0) {
					cells.push(<Cell
						color={Colors.BLACK} x={boardLetter} y={y}
						key={`${boardLetter}-${y}`}
						isAvailableForMove={isAvailableCellForMove(x, y)}
						isHavingFigure={isCellHavingFigure(x, y)}
						cellClicked={cellClicked}
						isSelected={isSelectedCell(x, y)}
					/>)
				} else {
					cells.push(<Cell
						color={Colors.WHITE} x={boardLetter} y={y}
						key={`${boardLetter}-${y}`}
						isAvailableForMove={isAvailableCellForMove(x, y)}
						isHavingFigure={isCellHavingFigure(x, y)}
						cellClicked={cellClicked}
						isSelected={isSelectedCell(x, y)}
					/>)
				}
			}
		}
		return cells;
	}

	const isEatableFigure = (figure: FigureData): boolean => {
		if (!choseFigurePos) return false;
		return choseFigurePos.availableCells[`${figure.x}-${figure.y}`];
	}

	const isSelectedFigure = (figure: FigureData): boolean => {
		if (!choseFigurePos) return false;
		return choseFigurePos.figure.id === figure.id;
	}

	const isSelectedCell = (x: number, y: number): boolean => {
		if (!choseFigurePos) return false;
		return choseFigurePos.figure.x === x && choseFigurePos.figure.y === y;
	}

	const initFigures = (): JSX.Element[] => {
		const figuresJSX: JSX.Element[] = [];

		for (let item in figures) {
			if (!figures[item].id || !figures[item].color) continue;
			cellsFigure[`${figures[item].x}-${figures[item].y}`] = figures[item];
			figuresJSX.push(<Figure
				figureClicked={figureClicked}
				key={figures[item].id}
				figure={figures[item]}
				isEatable={isEatableFigure(figures[item])}
				isSelected={isSelectedFigure(figures[item])}
			/>);
		}

		return figuresJSX;
	}

	const resizeBoard = () => {
		const paddingsWidth = 48 + 12;
		const paddingHeight = 52 + 12;

		if (boardRef.current) {
			const board = boardRef.current;
			board.style.height = '';
			board.style.width = '';

			const boardRect = board.getBoundingClientRect();
			const boardWidth = boardRect.width - paddingsWidth + paddingHeight;
			const boardHeight = boardRect.height - paddingHeight + paddingsWidth;

			if (boardHeight > boardWidth) {
				board.style.height = boardWidth + 'px';
			} else {
				board.style.width = boardHeight + 'px';
			}
		}
	}

	const figureClicked = (figure: FigureData) => {
		if (choseFigurePos && choseFigurePos.availableCells[`${figure.x}-${figure.y}`] && choseFigurePos.figure.color !== figure.color) {
			moveOrEat(choseFigurePos.figure, figure.x, figure.y);
			nextAIMoveDelayed();
			return;
		}

		if (choseFigurePos && choseFigurePos.figure.name === figure.name && figure.x === choseFigurePos.figure.x && choseFigurePos.figure.y === figure.y && choseFigurePos.figure.color === figure.color) {
			setChoseFigurePos(null);
			return;
		}

		if (sides.ally !== figure.color) return;

		if (isKingInCheck && figure.name !== Figures.KING) return;

		setChoseFigurePos({
			figure,
			availableCells: getAvailableCells(figure)
		});
	}

	const endGame = (winner: Colors) => {
		dispatch(setGameWon(winner));
		dispatch(setGameStarted(false))
	}

	const eatFigure = (figure: FigureData): void => {
		cellsFigure[`${figure.x}-${figure.y}`] = null;
		if (figure.name === Figures.KING) {
			endGame(getOtherColor(figure.color));
		}
		dispatch(removeFigure(figure));
	}

	const moveOrEat = (figure: FigureData, x: number, y: number): void => {
		const figureOnCell = cellsFigure[`${x}-${y}`];
		if (figureOnCell && figureOnCell.color !== figure.color) eatFigure(figureOnCell);
		moveOn(figure, x, y);
	}

	const getAvailableCells = (figure: FigureData, isForDangerousCells: boolean = false): { [key: string]: boolean } => {
		let way: { y: number, x: number }[] = [];

		const toStopWay = (x: number, y: number): boolean => {
			if (cellsFigure[`${x}-${y}`] === undefined) return true;
			if (cellsFigure[`${x}-${y}`]) return true;
			return false;
		}

		const checkCellForMove = (x: number, y: number): boolean => {
			if (toStopWay(x, y)) return false;
			way.push({x, y});
			return true;
		}

		const verticalTop = (toY: number, fromY: number = figure.y) => {
			for (let i = fromY + 1; i <= toY; i++) {
				if (toStopWay(figure.x, i)) return;
				way.push({y: i, x: figure.x});
			}
		}

		const verticalBottom = (toY: number, fromY: number = figure.y) => {
			for (let i = fromY - 1; i >= toY; i--) {
				if (toStopWay(figure.x, i)) return;
				way.push({y: i, x: figure.x});
			}
		}

		const horizontalLeft = (toX: number, fromX: number = figure.x) => {
			for (let i = fromX - 1; i >= toX; i--) {
				if (toStopWay(i, figure.y)) return;
				way.push({x: i, y: figure.y});
			}
		}

		const horizontalRight = (toX: number, fromX: number = figure.x) => {
			for (let i = fromX + 1; i <= toX; i++) {
				if (toStopWay(i, figure.y)) return;
				way.push({x: i, y: figure.y});
			}
		}

		const checkDiagonal = () => {
			// top right
			for (let i = 1; i <= 8; i++) {
				if (!checkCellForMove(figure.x + i, figure.y + i)) break;
			}
			// bottom right
			for (let i = 1; i <= 8; i++) {
				if (!checkCellForMove(figure.x + i, figure.y - i)) break;
			}
			// bottom left
			for (let i = 1; i <= 8; i++) {
				if (!checkCellForMove(figure.x - i, figure.y - i)) break;
			}
			for (let i = 1; i <= 8; i++) {
				if (!checkCellForMove(figure.x - i, figure.y + i)) break;
			}
		}

		const checkEatableFiguresByDiagonal = () => {
			for (let i = 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(figure.x + i, figure.y + i)) break;
			}
			// bottom right
			for (let i = 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(figure.x + i, figure.y - i)) break;
			}
			// bottom left
			for (let i = 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(figure.x - i, figure.y - i)) break;
			}
			for (let i = 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(figure.x - i, figure.y + i)) break;
			}
		}

		const isEatableCell = (x: number, y: number): boolean => {
			if (cellsFigure[`${x}-${y}`] && figure.color !== cellsFigure[`${x}-${y}`]?.color) return true;
			return false;
		}

		const checkEatableCell = (x: number, y: number): boolean => {
			if (isEatableCell(x, y)) {
				way.push({x, y})
				return true;
			}
			return false;
		}

		const checkEatableOrAlliesCell = (x: number, y: number): boolean => {
			if (cellsFigure[`${x}-${y}`] && cellsFigure[`${x}-${y}`]?.color === figure.color) return true;
			if (isEatableCell(x, y)) {
				way.push({x, y})
				return true;
			}
			return false;
		}

		// PAWN
		const checkEatableFiguresByPawn = () => {
			if (figure.color === Colors.BLACK) {
				checkEatableCell(figure.x - 1, figure.y - 1);
				checkEatableCell(figure.x + 1, figure.y - 1);
			} else {
				checkEatableCell(figure.x - 1, figure.y + 1);
				checkEatableCell(figure.x + 1, figure.y + 1);
			}
		}

		if (figure.name === Figures.PAWN) {
			if (figure.color === Colors.BLACK) {
				if (!isForDangerousCells) {
					verticalBottom(figure.y - 2);
				} else {
					way.push({y: figure.y - 1, x: figure.x - 1})
					way.push({y: figure.y - 1, x: figure.x + 1})
				}
			}
			if (figure.color === Colors.WHITE) {
				if (!isForDangerousCells) {
					verticalTop(figure.y + 2);
				} else {
					way.push({y: figure.y + 1, x: figure.x - 1})
					way.push({y: figure.y + 1, x: figure.x + 1})
				}
			}
			checkEatableFiguresByPawn();
		}

		// ROOK
		const checkEatableFiguresByRook = () => {
			// check top
			for (let i = figure.y + 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(figure.x, i)) break;
			}
			// check bottom
			for (let i = figure.y - 1; i >= 0; i--) {
				if (checkEatableOrAlliesCell(figure.x, i)) break;
			}
			// check left
			for (let i = figure.x - 1; i >= 0; i--) {
				if (checkEatableOrAlliesCell(i, figure.y)) break;
			}
			// check right
			for (let i = figure.x + 1; i <= 8; i++) {
				if (checkEatableOrAlliesCell(i, figure.y)) break;
			}
		}

		if (figure.name === Figures.ROOK) {
			verticalBottom(0);
			verticalTop(8);
			horizontalLeft(0);
			horizontalRight(8);
			checkEatableFiguresByRook();
		}

		// KNIGHT
		const checkMovesByKnight = () => {
			checkCellForMove(figure.x + 1, figure.y + 2);
			checkCellForMove(figure.x - 1, figure.y + 2);
			checkCellForMove(figure.x + 2, figure.y + 1);
			checkCellForMove(figure.x + 2, figure.y - 1);
			checkCellForMove(figure.x + 1, figure.y - 2);
			checkCellForMove(figure.x - 1, figure.y - 2);
			checkCellForMove(figure.x - 2, figure.y - 1);
			checkCellForMove(figure.x - 2, figure.y + 1);
		}

		const checkEatableFiguresByKnight = () => {
			checkEatableOrAlliesCell(figure.x + 1, figure.y + 2);
			checkEatableOrAlliesCell(figure.x - 1, figure.y + 2);
			checkEatableOrAlliesCell(figure.x + 2, figure.y + 1);
			checkEatableOrAlliesCell(figure.x + 2, figure.y - 1);
			checkEatableOrAlliesCell(figure.x + 1, figure.y - 2);
			checkEatableOrAlliesCell(figure.x - 1, figure.y - 2);
			checkEatableOrAlliesCell(figure.x - 2, figure.y - 1);
			checkEatableOrAlliesCell(figure.x - 2, figure.y + 1);
		}

		if (figure.name === Figures.KNIGHT) {
			checkMovesByKnight();
			checkEatableFiguresByKnight();
		}

		// BISHOP
		if (figure.name === Figures.BISHOP) {
			checkDiagonal();
			checkEatableFiguresByDiagonal();
		}

		// QUEEN
		if (figure.name === Figures.QUEEN) {
			checkDiagonal();
			checkEatableFiguresByDiagonal();
			verticalBottom(0);
			verticalTop(8);
			horizontalLeft(0);
			horizontalRight(8);
			checkEatableFiguresByRook();
		}

		// KING
		const checkKingDiagonal = () => {
			checkCellForMove(figure.x + 1, figure.y + 1);
			checkCellForMove(figure.x + 1, figure.y - 1);
			checkCellForMove(figure.x - 1, figure.y - 1);
			checkCellForMove(figure.x - 1, figure.y + 1);
		}

		const checkEatableFiguresByKing = () => {
			checkEatableOrAlliesCell(figure.x + 1, figure.y + 1);
			checkEatableOrAlliesCell(figure.x + 1, figure.y - 1);
			checkEatableOrAlliesCell(figure.x - 1, figure.y - 1);
			checkEatableOrAlliesCell(figure.x - 1, figure.y + 1);
			checkEatableOrAlliesCell(figure.x + 1, figure.y);
			checkEatableOrAlliesCell(figure.x - 1, figure.y);
			checkEatableOrAlliesCell(figure.x, figure.y + 1);
			checkEatableOrAlliesCell(figure.x, figure.y - 1);
		}

		if (figure.name === Figures.KING) {
			verticalBottom(figure.y - 1);
			verticalTop(figure.y + 1);
			horizontalLeft(figure.x - 1);
			horizontalRight(figure.x + 1)
			checkKingDiagonal();
			checkEatableFiguresByKing();

			const cellsForRemoving:{x: number, y: number}[] = [];
			for (let i = 0; i < way.length; i++) {
				if (dangerousCells.current[getOtherColor(figure.color)][`${way[i].x}-${way[i].y}`]) {
					cellsForRemoving.push({x: way[i].x, y: way[i].y})
				}
			}
			cellsForRemoving.forEach(elw => {
				way = way.filter(el => !(el.y === elw.y && el.x === elw.x) )
			});
		}


		const obj: { [key: string]: boolean } = {};
		way.forEach(el => {
			obj[`${el.x}-${el.y}`] = true;
		});
		return obj;
	}

	const nextAIMove = () => {
		const figures = store.getState().game.figures;

		const getRandomElementOfArray = <T extends unknown>(arr: T[]): T => {
			return arr[Math.floor(Math.random() * arr.length)];
		}

		const figuresIds = Object.keys(figures);
		if (figuresIds.length < 1) return;
		const enemyFiguresIds = figuresIds.filter(id => figures[id].color === sides.enemy);
		let randomFigureId = getRandomElementOfArray(enemyFiguresIds);
		let availableCells = getAvailableCells(figures[randomFigureId]);
		let availableCellsArr = Object.keys(availableCells);
		const triedFiguresIds: string[] = [];
		while (availableCellsArr.length < 1) {
			if (triedFiguresIds.length >= enemyFiguresIds.length) return;
			randomFigureId = getRandomElementOfArray(enemyFiguresIds);
			availableCells = getAvailableCells(figures[randomFigureId]);
			availableCellsArr = Object.keys(availableCells);
			triedFiguresIds.push(randomFigureId);
		}
		const cellForMove = getRandomElementOfArray(availableCellsArr);
		const [x, y] = cellForMove.split('-');
		moveOrEat(figures[randomFigureId], Number(x), Number(y));
	}

	const nextAIMoveDelayed = (delay: number = 200) => {
		setTimeout(nextAIMove, delay);
	};

	const getFiguresBySide = (color: Colors) => {
		return Object.keys(figures).filter(figureId => figures[figureId].color === color).map(figureId => figures[figureId]);
	}

	const updateAllAvailableCells = () => {
		dangerousCells.current.white = {};
		dangerousCells.current.black = {};
		const whiteFigures = getFiguresBySide(Colors.WHITE);
		const blackFigures = getFiguresBySide(Colors.BLACK);
		whiteFigures.forEach(figure => {
			dangerousCells.current.white = {
				...dangerousCells.current.white,
				...getAvailableCells(figure, true),
			};
		});
		blackFigures.forEach(figure => {
			dangerousCells.current.black = {
				...dangerousCells.current.black,
				...getAvailableCells(figure, true),
			};
		});
	}

	const getOtherColor = (color: Colors) => {
		return color === Colors.BLACK ? Colors.WHITE : Colors.BLACK;
	}

	const checkIsKingInCheck = (color: Colors) => {
		updateAllAvailableCells();
		const kings = {
			[Colors.WHITE]: figures['white-king-4-1'],
			[Colors.BLACK]: figures['black-king-4-8']
		}
		const king = kings[color];
		if (!king) return;
		if (dangerousCells.current[getOtherColor(color)][`${king.x}-${king.y}`]) setIsKingInCheck(true);
		else setIsKingInCheck(false);
	};

	const getGameWonJSX = (): JSX.Element | null => {
		if (!gameWon) return null;
		const color = gameWon[0].toUpperCase() + gameWon.slice(1);

		return <div className={styles.gameWon}>
			<h2 className={styles.gameWonTitle}>{ color } won</h2>
			<Link to="/" className={styles.gameWonButton}>Main page</Link>
		</div>;
	}

	useEffect(() => {
		checkIsKingInCheck(sides.ally);
	}, [figures])

	useEffect(() => {
		resizeBoard();
		window.addEventListener('resize', resizeBoard);
		dispatch(setGameStarted(true));
	}, [])

	return <div className={styles.boardWrapper} ref={boardRef}>
		<ul className={styles.boardLeft}>
			<li className={styles.boardLeftItem}>1</li>
			<li className={styles.boardLeftItem}>2</li>
			<li className={styles.boardLeftItem}>3</li>
			<li className={styles.boardLeftItem}>4</li>
			<li className={styles.boardLeftItem}>5</li>
			<li className={styles.boardLeftItem}>6</li>
			<li className={styles.boardLeftItem}>7</li>
			<li className={styles.boardLeftItem}>8</li>
		</ul>

		<ul className={styles.boardBottom}>
			<li className={styles.boardBottomItem}>A</li>
			<li className={styles.boardBottomItem}>B</li>
			<li className={styles.boardBottomItem}>C</li>
			<li className={styles.boardBottomItem}>D</li>
			<li className={styles.boardBottomItem}>E</li>
			<li className={styles.boardBottomItem}>F</li>
			<li className={styles.boardBottomItem}>G</li>
			<li className={styles.boardBottomItem}>H</li>
		</ul>

		<ul className={styles.board}>
			{initCells()}
			{initFigures()}
		</ul>

		{ getGameWonJSX() }
	</div>
}

export default Board;




// Этот код представляет собой React-компонент, который реализует шахматную доску и игровую логику для одиночной игры в шахматы против искусственного интеллекта (ИИ). Вот краткое описание кода:

// Импорт библиотек и зависимостей:

// React-компоненты и хуки из библиотеки React.
// Стили из модуля Board.module.scss.
// Различные типы и константы (например, BoardLettersByNumber, Colors, Figures) из модуля types.
// Действия Redux и хуки для взаимодействия с Redux-стейтом.
// Инициализация компонента:

// Получение доступа к диспетчеру Redux (dispatch) и селекторам для чтения данных из Redux-стейта.
// Использование хука useState для управления состоянием переменной isKingInCheck и choseFigurePos.
// Использование useRef для хранения данных о опасных клетках (dangerousCells) и для ссылки на DOM-элемент доски (boardRef).
// Обработка ячеек доски и фигур:

// Создание доски с ячейками и фигурами при помощи вложенных циклов (initCells и initFigures).
// Обработка событий клика на ячейку (cellClicked) и фигуру (figureClicked).
// Перемещение фигур по доске, обновление Redux-стейта и запуск хода ИИ (moveOn).
// Логика фигур:

// Проверка доступности ячейки для хода (isAvailableCellForMove).
// Проверка наличия фигуры в ячейке (isCellHavingFigure).
// Обработка различных типов фигур: пешки, ладьи, кони, слоны, ферзи и короли.
// Логика ИИ:

// Автоматическое выполнение хода ИИ (nextAIMove) с учетом доступных клеток и случайного выбора фигуры.
// Задержка перед ходом ИИ (nextAIMoveDelayed).
// Обработка завершения игры:

// Проверка и объявление победы (endGame) с указанием цвета победившей стороны.
// Обновление данных об опасных клетках:

// Обновление информации об опасных клетках для каждой стороны (updateAllAvailableCells).
// Проверка, находится ли король под угрозой (checkIsKingInCheck).
// Эффекты жизненного цикла:

// Использование useEffect для обновления опасных клеток при изменении фигур на доске.
// Использование useEffect для обновления размера доски при изменении размеров окна и запуска начала игры.
// Отображение результата игры:

// Отображение сообщения о победе одной из сторон, если игра завершена.
// Рендеринг компонента:

// Возвращение JSX-разметки, содержащей доску, фигуры, метки для координат и сообщение о победе.
// Компонент создает интерактивную шахматную доску, обрабатывает пользовательские действия, выполняет ходы ИИ, обновляет состояние и отображает результаты игры.



// Давайте более подробно рассмотрим, как реализована логика ходов фигур в шахматной доске в представленном коде.

// Обработка ходов фигур:
// Пешка (Figures.PAWN):

// Пешка может двигаться вперед на одну клетку, если там нет другой фигуры.
// При первом ходе пешка может сделать два шага вперед.
// Пешка может атаковать по диагонали на одну клетку.
// Реализована логика "взятия на проходе" для пешек.
// Ладья (Figures.ROOK):

// Ладья двигается по вертикали или горизонтали на любое количество клеток.
// Она не может перепрыгивать другие фигуры.
// Конь (Figures.KNIGHT):

// Конь делает "букву L" - два шага в одном направлении (горизонтально или вертикально), затем один шаг перпендикулярно.
// Слон (Figures.BISHOP):

// Слон двигается по диагонали на любое количество клеток.
// Как и ладья, слон не может прыгать через другие фигуры.
// Ферзь (Figures.QUEEN):

// Ферзь объединяет ходы ладьи и слона: он может двигаться по вертикали, горизонтали и диагонали на любое количество клеток.
// Король (Figures.KING):

// Король может двигаться на одну клетку в любом направлении.
// Король также может выполнить рокировку с ладьей при определенных условиях.
// Логика обработки ходов:
// Проверка доступных ходов (getAvailableCells):

// Для каждой фигуры определена функция getAvailableCells, которая возвращает объект, содержащий доступные для хода клетки.
// Эта функция учитывает правила движения для каждой конкретной фигуры.
// Обработка "взятия" фигур:

// При ходе, если на конечной клетке находится фигура противоположного цвета, она считается взятой и удаляется с доски.
// Если взятая фигура — король, игра завершается.
// Обработка "рокировки" (для короля и ладьи):

// Если король и ладья не совершали предыдущих ходов и нет фигур между ними, то король может сделать рокировку.
// Рокировка — это специальный ход, при котором король и одна из ладей перемещаются друг к другу.
// Логика "взятия на проходе" (для пешек):

// Если пешка противоположного цвета сделала начальный двойной ход и оказалась рядом с текущей пешкой, последняя может взять ее на проходе.
// Логика определения шаха и мате:

// Когда король оказывается под угрозой (шах), определяется, может ли он избежать взятия (блокировкой, перемещением).
// Если король не может избежать взятия, игра завершается (мат).
// Логика ИИ (nextAIMove и getAvailableCells):
// Выбор случайной фигуры противника:

// ИИ случайным образом выбирает фигуру, которой будет ходить.
// Получение доступных ходов для выбранной фигуры:

// Вызывается функция getAvailableCells, чтобы определить, на какие клетки может переместиться выбранная фигура.
// Выбор случайной клетки для хода:

// ИИ случайным образом выбирает одну из доступных клеток для перемещения фигуры.
// Выполнение хода ИИ:

// ИИ перемещает выбранную фигуру на выбранную клетку.
// При необходимости выполняется взятие противника.
// Обновление опасных клеток (updateAllAvailableCells):
// Обновление опасных клеток для обеих сторон:

// Для каждой стороны (белые и черные) определяются опасные клетки, находящиеся под угрозой фигур противоположной стороны.
// Проверка шаха:

// Определяется, находится ли король текущей стороны под угрозой (шах).
// Отображение сообщения о победе:

// Если какой-то король взят, игра завершается и отображается сообщение о победе.
// Таким образом, представленный код реализует базовую логику для игры в шахматы против искусственного интеллекта, включая правила движения фигур, обработку ходов, логику ИИ и определение шаха и мате.